import moment from 'moment';
import colors from '../colors';
import { Line } from '@nivo/line';
import React, { Component } from 'react';
import globalConfigs from '../configs/globalConfigs';
import FunctionsUtil from '../utilities/FunctionsUtil';
import GenericChart from '../GenericChart/GenericChart';
import availableTokens from '../configs/availableTokens';
const env = process.env;

class StatsChart extends Component {
  state = {
    chartProps:{},
    chartType:null,
    chartData:null,
    chartWidth:null
  };

  async componentWillMount() {
    window.addEventListener('resize', this.handleWindowSizeChange);
  }

  async componentDidMount() {
    this.loadUtils();
    this.handleWindowSizeChange();
    this.loadApiData();
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.tokenConfig !== this.props.tokenConfig){
      this.componentDidMount();
    }
  }

  handleWindowSizeChange = () => {
    const chartContainer = document.getElementById(this.props.parentId);
    if (chartContainer && chartContainer.offsetWidth !== this.state.chartWidth){
      const chartWidth = chartContainer.offsetWidth;
      return this.setState({
        chartWidth
      });
    }
  };

  // Utils
  functionsUtil = null;
  loadUtils(){
    if (this.functionsUtil){
      this.functionsUtil.setProps(this.props);
    } else {
      this.functionsUtil = new FunctionsUtil(this.props);
    }
  }

  getTokenData = async (address) => {
    const apiInfo = globalConfigs.stats.rates;
    const endpoint = `${apiInfo.endpoint}${address}`;
    const TTL = apiInfo.TTL ? apiInfo.TTL : 0;
    let output = await this.functionsUtil.makeCachedRequest(endpoint,TTL,true);
    return output.filter((r,i) => { return r.timestamp >= this.props.startTimestamp });
  }

  abbreviateNumber = (value) => {
    let newValue = value;
    if (value >= 1000) {
      const suffixes = ["", "k", "m", "b","t"];
      const suffixNum = Math.floor( (""+value).length/4 );
      let shortValue = '';
      for (let precision = 3; precision >= 1; precision--) {
        shortValue = parseFloat( (suffixNum !== 0 ? (value / Math.pow(1000,suffixNum) ) : value).toPrecision(precision));
        const dotLessShortValue = (shortValue + '').replace(/[^a-zA-Z 0-9]+/g,'');
        if (dotLessShortValue.length <= 3) { break; }
      }
      if (shortValue % 1 !== 0)  shortValue = shortValue.toFixed(2);
      newValue = shortValue+suffixes[suffixNum];
    }
    return newValue;
  }

  loadApiData = async () => {

    if (!this.props.tokenConfig || !this.props.selectedToken || !this.props.chartMode){
      return false;
    }

    const apiResults = await this.getTokenData(this.props.tokenConfig.address);

    const chartData = [];
    let chartProps = {};
    let chartType = Line;

    switch (this.props.chartMode){
      case 'VOL':
        const etherscanInfo = globalConfigs.network.providers.etherscan;
        const etherscanApiUrl = etherscanInfo.endpoints[globalConfigs.network.requiredNetwork];
        const endpoint = `${etherscanApiUrl}?apikey=${env.REACT_APP_ETHERSCAN_KEY}&module=account&action=tokentx&address=${this.props.tokenConfig.idle.address}&startblock=0&endblock=999999999&sort=asc`;
        const txs = await this.functionsUtil.makeCachedRequest(endpoint,60,true);        

        if (txs && txs.result){
          const results = txs.result;

          const filteredTxs = results.filter(
              tx => {
                const internalTxs = results.filter(r => r.hash === tx.hash);
                const isRightToken = internalTxs.length>1 && internalTxs.indexOf(tx) === 0;
                const isDepositTx = isRightToken && tx.to.toLowerCase() === this.props.tokenConfig.idle.address.toLowerCase();
                const isRedeemTx = isRightToken && tx.from.toLowerCase() === this.props.tokenConfig.idle.address.toLowerCase();

                return tx.timeStamp>=this.props.startTimestamp && (isDepositTx || isRedeemTx);
            }
          ).map(tx => {
            return ({...tx, value: this.functionsUtil.fixTokenDecimals(tx.value,this.props.tokenConfig.decimals)});
          });

          const startTimestamp = parseInt(filteredTxs[0].timeStamp);
          const endTimestamp = parseInt(moment()._d.getTime()/1000); //parseInt(filteredTxs[filteredTxs.length-1].timeStamp);

          const deposits = {};
          const redeems = {};

          for (let timestamp=startTimestamp;timestamp<=endTimestamp;timestamp+=3600){
            const x = moment(timestamp*1000).format("YYYY/MM/DD HH:00");
            const y = 0;
            if (!deposits[x]){
              deposits[x] = { x, y };
            }
            if (!redeems[x]){
              redeems[x] = { x, y };
            }
          }

          filteredTxs
            .filter((tx) => { return tx.to.toLowerCase() === this.props.tokenConfig.idle.address.toLowerCase(); })
            .forEach((tx,i) => {
              // console.log(`Deposit of ${tx.value} ${this.props.selectedToken} - ${tx.hash}`);
              const x = moment(tx.timeStamp*1000).format("YYYY/MM/DD HH:00");
              if (!deposits[x]){
                deposits[x] = {
                  x,
                  y:0
                };
              }

              deposits[x].y+=parseFloat(tx.value);
            });

          filteredTxs
            .filter((tx) => { return tx.from.toLowerCase() === this.props.tokenConfig.idle.address.toLowerCase(); })
            .forEach((tx,i) => {
              // console.log(`Redeem of ${tx.value} ${this.props.selectedToken} - ${tx.hash}`);
              const x = moment(tx.timeStamp*1000).format("YYYY/MM/DD HH:00");
              if (!redeems[x]){
                redeems[x] = {
                  x,
                  y:0
                };
              }

              redeems[x].y+=parseFloat(tx.value);
            });

          chartData.push({
            id:'Deposits',
            color: colors.blue,
            data: Object.values(deposits)
          });

          chartData.push({
            id:'Redeems',
            color: colors.green,
            data: Object.values(redeems)
          });

          // Set chart type
          chartType = Line;

          chartProps = {
            xScale:{
              type: 'time',
              format: '%Y/%m/%d %H:%M',
            },
            xFormat:'time:%b %d %H:%M',
            yFormat:value => (parseInt(value)>=1000 ? parseFloat(value/1000).toFixed(1)+'K' : parseFloat(value).toFixed(1) )+' '+this.props.selectedToken,
            yScale:{
              type: 'linear',
              stacked: false
            },
            axisLeft:{
              format: v => this.abbreviateNumber(v),
              orient: 'left',
              tickSize: 5,
              tickPadding: 5,
              tickRotation: 0,
              legend: '',
              legendOffset: -65,
              legendPosition: 'middle'
            },
            axisBottom:{
              format: '%b %d %H:%M',
              tickValues: 'every 3 days',
              orient: 'bottom',
              legend: '',
              legendOffset: 36,
              legendPosition: 'middle'
            },
            enableArea:false,
            curve:"monotoneX",
            enableSlices:'x',
            enableGridX:true,
            enableGridY:false,
            colors:d => d.color,
            pointSize:0,
            pointColor:{ from: 'color', modifiers: []},
            pointBorderWidth:1,
            pointLabel:"y",
            pointLabelYOffset:-12,
            useMesh:true,
            animate:false,
            margin:{ top: 20, right: 20, bottom: 60, left: 80 }
          };
        }
      break;
      case 'AUM_ALL':
        await this.functionsUtil.asyncForEach(Object.keys(availableTokens[globalConfigs.network.requiredNetwork]),async (tokenName,i) => {
          const tokenConfig = availableTokens[globalConfigs.network.requiredNetwork][tokenName];
          const tokenDataApi = await this.getTokenData(tokenConfig.address);
          chartData.push({
            id:tokenName,
            color: tokenConfig.color,
            data: tokenDataApi.map((d,i) => {
              const idleTokens = this.functionsUtil.fixTokenDecimals(d.idleSupply,18);
              const idlePrice = this.functionsUtil.fixTokenDecimals(d.idlePrice,tokenConfig.decimals);
              const aum = idleTokens.times(idlePrice);
              return {
                x: moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm"),
                y: parseInt(aum.toString())
              };
            })
          });
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'hour',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat:value => (parseInt(value)>=1000 ? parseFloat(value/1000).toFixed(1)+'K' : parseFloat(value) )+' '+this.props.selectedToken,
          yScale:{
            type: 'linear',
            stacked: false
          },
          axisLeft:{
            format: v => this.abbreviateNumber(v),
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -65,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          enableArea:false,
          curve:"linear",
          enableSlices:'x',
          enableGridX:true,
          enableGridY:false,
          colors:d => d.color,
          pointSize:0,
          pointColor:{ from: 'color', modifiers: []},
          pointBorderWidth:1,
          pointLabel:"y",
          pointLabelYOffset:-12,
          useMesh:true,
          animate:false,
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      case 'AUM':
        chartData.push({
          id:'AUM',
          color: "hsl(227, 100%, 50%)",
          data: apiResults.map((d,i) => {
            const idleTokens = this.functionsUtil.fixTokenDecimals(d.idleSupply,18);
            const idlePrice = this.functionsUtil.fixTokenDecimals(d.idlePrice,this.props.tokenConfig.decimals);
            const aum = idleTokens.times(idlePrice);
            return {
              x: moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm"),
              y: parseInt(aum.toString())
            };
          })
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'hour',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat:value => (parseInt(value)>=1000 ? parseFloat(value/1000).toFixed(1)+'K' : parseFloat(value) )+' '+this.props.selectedToken,
          yScale:{
            type: 'linear',
            stacked: false
          },
          axisLeft:{
            format: v => this.abbreviateNumber(v),
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -65,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          enableArea:true,
          curve:"linear",
          enableSlices:false,
          enableGridX:true,
          enableGridY:false,
          colors:d => d.color,
          pointSize:0,
          pointColor:{ from: 'color', modifiers: []},
          pointBorderWidth:1,
          pointLabel:"y",
          pointLabelYOffset:-12,
          useMesh:true,
          animate:false,
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      case 'ALL':
        this.props.tokenConfig.protocols.forEach((p,j) => {
          chartData.push({
            id:p.name,
            color: globalConfigs.stats.protocols[p.name].color,
            data: apiResults.map((d,i) => {
              return d.protocolsData.filter((protocolAllocation,x) => {
                  return protocolAllocation.protocolAddr.toLowerCase() === p.address.toLowerCase()
              })
              .map((protocolAllocation,z) => {
                const x = moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm");
                const y = parseInt(this.functionsUtil.fixTokenDecimals(protocolAllocation.allocation,this.props.tokenConfig.decimals));
                return { x, y };
              })[0]
            })
          })
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'hour',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat:value => (parseInt(value)>=1000 ? parseFloat(value/1000).toFixed(1)+'K' : parseFloat(value) )+' '+this.props.selectedToken,
          yScale:{
            type: 'linear',
            stacked: false
          },
          axisLeft:{
            format: v => this.abbreviateNumber(v),
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -70,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          pointSize:0,
          useMesh:true,
          animate:false,
          pointLabel:"y",
          curve:'linear',
          enableArea:true,
          enableSlices:'x',
          enableGridX:true,
          enableGridY:false,
          pointBorderWidth:1,
          colors:d => d.color,
          pointLabelYOffset:-12,
          pointColor:{ from: 'color', modifiers: []},
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      case 'ALL_PERC':
        this.props.tokenConfig.protocols.forEach((p,j) => {
          chartData.push({
            id:p.name,
            color: globalConfigs.stats.protocols[p.name].color,
            data: apiResults.map((d,i) => {
              const totalAllocation = d.protocolsData.reduce((accumulator,protocolAllocation) => {
                const allocation = this.functionsUtil.fixTokenDecimals(protocolAllocation.allocation,this.props.tokenConfig.decimals);
                return this.functionsUtil.BNify(accumulator).plus(allocation);
              },0);

              return d.protocolsData.filter((protocolAllocation,x) => {
                  return protocolAllocation.protocolAddr.toLowerCase() === p.address.toLowerCase()
              })
              .map((protocolAllocation,z) => {
                const allocation = this.functionsUtil.fixTokenDecimals(protocolAllocation.allocation,this.props.tokenConfig.decimals);
                const x = moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm");
                const y = parseFloat(allocation.div(totalAllocation).times(100));
                return { x, y };
              })[0]
            })
          })
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'hour',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat: value => value.toFixed(2)+'%',
          yScale:{
            type: 'linear',
            stacked: false
          },
          axisLeft:{
            format: value => parseInt(value)+'%',
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -70,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          enableArea:true,
          curve:"linear",
          enableSlices:'x',
          enableGridX:true,
          enableGridY:false,
          colors:d => d.color,
          pointSize:0,
          pointColor:{ from: 'color', modifiers: []},
          pointBorderWidth:1,
          pointLabel:"y",
          pointLabelYOffset:-12,
          useMesh:true,
          animate:false,
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      case 'APR':
        this.props.tokenConfig.protocols.forEach((p,j) => {
          chartData.push({
            id:p.name,
            color: globalConfigs.stats.protocols[p.name].color,
            data: apiResults.map((d,i) => {
              return d.protocolsData.filter((protocolAllocation,x) => {
                  return protocolAllocation.protocolAddr.toLowerCase() === p.address.toLowerCase()
              })
              .map((protocolAllocation,z) => {
                const x = moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm");
                const y = parseFloat(this.functionsUtil.fixTokenDecimals(protocolAllocation.rate,18));
                return { x, y };
              })[0]
            })
          })
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'hour',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat:value => parseFloat(value).toFixed(2)+'%',
          yScale:{
            type: 'linear',
            stacked: false
          },
          axisLeft:{
            format: value => parseFloat(value).toFixed(2)+'%',
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -70,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          pointSize:0,
          useMesh:true,
          animate:false,
          pointLabel:"y",
          curve:'linear',
          enableArea:false,
          enableSlices:'x',
          enableGridX:true,
          enableGridY:false,
          pointBorderWidth:1,
          colors:d => d.color,
          pointLabelYOffset:-12,
          pointColor:{ from: 'color', modifiers: []},
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      case 'PRICE':
        this.props.tokenConfig.protocols.forEach((p,j) => {
          let lastRate = 0;
          const initBalance = 1;
          chartData.push({
            id:p.name,
            color: globalConfigs.stats.protocols[p.name].color,
            data: apiResults.map((d,i) => {
              return d.protocolsData.filter((protocolAllocation,x) => {
                  return protocolAllocation.protocolAddr.toLowerCase() === p.address.toLowerCase()
              })
              .map((protocolAllocation,z) => {
                const x = moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm");
                const rate = parseFloat(this.functionsUtil.fixTokenDecimals(protocolAllocation.price,p.functions.exchangeRate.decimals));
                const diff = lastRate ? rate/lastRate-1 : 0;
                const y = initBalance+diff;

                if (!lastRate){
                  lastRate = rate;
                }

                return { x, y };
              })[0]
            })
          })
        });

        let lastRate = 0;
        const initBalance = 1;
        chartData.push({
          id:`Idle`,
          color: 'hsl(227, 100%, 50%)',
          data: apiResults.map((d,i) => {
            const x = moment(d.timestamp*1000).format("YYYY/MM/DD HH:mm");
            const rate = parseFloat(this.functionsUtil.fixTokenDecimals(d.idlePrice,this.props.tokenConfig.decimals));
            const diff = lastRate ? rate/lastRate-1 : 0;
            const y = initBalance+diff;

            if (!lastRate){
              lastRate = rate;
            }

            return { x, y };
          })
        });

        // Set chart type
        chartType = Line;

        chartProps = {
          xScale:{
            type: 'time',
            format: '%Y/%m/%d %H:%M',
            // precision: 'day',
          },
          xFormat:'time:%b %d %H:%M',
          yFormat:value => parseFloat(value).toFixed(6),
          yScale:{
            type: 'linear',
            stacked: false,
            min: 1
          },
          axisLeft:{
            format: value => parseFloat(value).toFixed(6),
            orient: 'left',
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: '',
            legendOffset: -70,
            legendPosition: 'middle'
          },
          axisBottom:{
            format: '%b %d %H:%M',
            tickValues: 'every 3 days',
            orient: 'bottom',
            legend: '',
            legendOffset: 36,
            legendPosition: 'middle'
          },
          pointSize:0,
          useMesh:true,
          animate:false,
          pointLabel:"y",
          curve:'linear',
          enableArea:false,
          enableSlices:'x',
          enableGridX:true,
          enableGridY:false,
          pointBorderWidth:1,
          colors:d => d.color,
          pointLabelYOffset:-12,
          pointColor:{ from: 'color', modifiers: []},
          margin:{ top: 20, right: 20, bottom: 60, left: 80 }
        };
      break;
      default:
      break;
    }

    this.setState({
      chartType,
      chartProps,
      chartData
    });
  }

  render() {
    if (!this.state.chartType || !this.state.chartData || !this.state.chartProps){
      return null;
    }

    return (
      <GenericChart
        type={this.state.chartType}
        data={this.state.chartData}
        {...this.state.chartProps}
        width={this.state.chartWidth}
        height={this.props.height}
      />
    );
  }
}

export default StatsChart;