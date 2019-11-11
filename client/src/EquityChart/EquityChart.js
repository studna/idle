import React, { Component } from 'react';
import { Flex, Box, Text, Card, Image, Slider, Heading} from "rimble-ui";
import { ResponsiveLine } from '@nivo/line';
import request from 'request';
import axios from 'axios';
import moment from 'moment';
import styles from './EquityChart.module.scss';

const env = process.env;

const IdleAddress = '0xAcf651Aad1CBB0fd2c7973E2510d6F63b7e440c9';
const cDAIAddress = '0xf5dce57282a584d2746faf1593d3121fcac444dc';
const iDAIAddress = '0x14094949152eddbfcd073717200da82fed8dc960';

class EquityChart extends Component {
  state = {
    secondsInYear:315569260,
    initialBalance:1000,
    graphData: null,
    minValue: null,
    maxValue: null,
  };
  setSection(section) {
    this.setState(state => ({...state, selectedSection: section}));
  }

  async componentDidMount(){
    await this.getEquity();
    // this.getEquity_static();
  }

  async asyncForEach(array, callback){
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

  async getContractTransactions(){
    const txs = await this.makeCachedRequest(`https://api.etherscan.io/api?module=account&action=tokentx&address=${IdleAddress}&startblock=8119247&endblock=999999999&sort=asc&apikey=${env.REACT_APP_ETHERSCAN_KEY}`,43200).catch(err => {
      console.log('Error getting internal txs');
    });
    return txs ? txs.data.result : null;
  }

  filterGraphData(graphData,startTimestamp){
    // console.log('Filter graph from',startTimestamp,moment(startTimestamp*1000).format('DD/MM/YYYY'));
    graphData.forEach((v,i)=>{
      for (var j = 0; j < v.data.length; j++) {
        const d = v.data[j];
        // console.log(i,j,d.t,startTimestamp,d.x,moment(d.t*1000).format('DD/MM/YYYY'),moment(startTimestamp*1000).format('DD/MM/YYYY'),d.t<startTimestamp);
        if (d.t<startTimestamp){
          graphData[i].data.splice(j,1);
          j--;
        }
      }
    });
    // console.log(graphData);
    return graphData;
  }

  getGraphDataMinMax(graphData){
    let min = null;
    let max = null;
    graphData.forEach((v,i)=>{
      v.data.forEach((apr,j)=>{
        if (!min || apr.y<min){
          min = apr.y;
        }
        if (!max || apr.y>max){
          max = apr.y;
        }
      });
    });
    return [min,max];
  }

  getGraphDays(graphData){
    return parseInt((graphData[0].data[graphData[0].data.length-1].t-graphData[0].data[0].t)/(60*60*24));
  }

  getEquity_static(){
    const graphData = [{"id":"Compound",'pos':1,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc","icon":"compound-mark-green.png","color":"hsl(162, 100%, 41%)","aprs":[{"t":1565841600,"x":"15/08/2019","y":11.1814246279,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1566187200,"x":"19/08/2019","y":11.2574768226},{"t":1566532800,"x":"23/08/2019","y":10.524299471},{"t":1566964800,"x":"28/08/2019","y":9.889625284},{"t":1567310400,"x":"01/09/2019","y":10.0920870812},{"t":1567656000,"x":"05/09/2019","y":9.5143638809},{"t":1568088000,"x":"10/09/2019","y":7.17614515},{"t":1568433600,"x":"14/09/2019","y":7.2869755401},{"t":1568779200,"x":"18/09/2019","y":7.2847125058},{"t":1569211200,"x":"23/09/2019","y":8.5927022122},{"t":1569556800,"x":"27/09/2019","y":8.258009679},{"t":1569902400,"x":"01/10/2019","y":8.1846270271,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1570334400,"x":"06/10/2019","y":7.7331059741,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1570680000,"x":"10/10/2019","y":7.4281545568,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1571025600,"x":"14/10/2019","y":7.4491409258},{"t":1571457600,"x":"19/10/2019","y":7.3153018689,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1571803200,"x":"23/10/2019","y":6.8672401353,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1572235200,"x":"28/10/2019","y":6.2244060043},{"t":1572580800,"x":"01/11/2019","y":6.7140658119},{"t":1572930000,"x":"05/11/2019","y":4.2932645509},{"t":1573275600,"x":"09/11/2019","y":4.0003061174}],"data":[{"t":1565841600,"x":"15/08/2019","y":"0.0000"},{"t":1566187200,"x":"19/08/2019","y":"0.1225"},{"t":1566532800,"x":"23/08/2019","y":"0.2458"},{"t":1566964800,"x":"28/08/2019","y":"0.3899"},{"t":1567310400,"x":"01/09/2019","y":"0.4982"},{"t":1567656000,"x":"05/09/2019","y":"0.6088"},{"t":1568088000,"x":"10/09/2019","y":"0.7391"},{"t":1568433600,"x":"14/09/2019","y":"0.8178"},{"t":1568779200,"x":"18/09/2019","y":"0.8976"},{"t":1569211200,"x":"23/09/2019","y":"0.9975"},{"t":1569556800,"x":"27/09/2019","y":"1.0917"},{"t":1569902400,"x":"01/10/2019","y":"1.1822"},{"t":1570334400,"x":"06/10/2019","y":"1.2944"},{"t":1570680000,"x":"10/10/2019","y":"1.3792"},{"t":1571025600,"x":"14/10/2019","y":"1.4606"},{"t":1571457600,"x":"19/10/2019","y":"1.5628"},{"t":1571803200,"x":"23/10/2019","y":"1.6430"},{"t":1572235200,"x":"28/10/2019","y":"1.7372"},{"t":1572580800,"x":"01/11/2019","y":"1.8054"},{"t":1572930000,"x":"05/11/2019","y":"1.8799"},{"t":1573275600,"x":"09/11/2019","y":"1.9270"}],"endpoint":"https://defiportfolio-backend.herokuapp.com/api/v1/markets/compound_v2/dai?start_date=1565866741"},{"id":"Fulcrum",'pos':3,"address":"0x14094949152eddbfcd073717200da82fed8dc960","icon":"fulcrum-mark.png","color":"hsl(197, 98%, 38%)","aprs":[{"t":1565841600,"x":"15/08/2019","y":12.0012999748,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566187200,"x":"19/08/2019","y":11.9071898338,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566532800,"x":"23/08/2019","y":10.9043702637,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566964800,"x":"28/08/2019","y":10.898848905,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1567310400,"x":"01/09/2019","y":11.0713746174,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1567656000,"x":"05/09/2019","y":7.0411276517,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568088000,"x":"10/09/2019","y":9.0967959005,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568433600,"x":"14/09/2019","y":8.2304366531,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568779200,"x":"18/09/2019","y":8.3610064414,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569211200,"x":"23/09/2019","y":8.8595258625,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569556800,"x":"27/09/2019","y":6.9153156339,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569902400,"x":"01/10/2019","y":7.7938638833},{"t":1570334400,"x":"06/10/2019","y":4.0921954068},{"t":1570680000,"x":"10/10/2019","y":7.5403471655},{"t":1571025600,"x":"14/10/2019","y":7.2633040984,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1571457600,"x":"19/10/2019","y":7.3605016941},{"t":1571803200,"x":"23/10/2019","y":6.8471006648},{"t":1572235200,"x":"28/10/2019","y":6.6498551182,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1572580800,"x":"01/11/2019","y":6.8810257801,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1572930000,"x":"05/11/2019","y":5.4327273052,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1573275600,"x":"09/11/2019","y":5.1890604418,"address":"0x14094949152eddbfcd073717200da82fed8dc960"}],"data":[{"t":1565841600,"x":"15/08/2019","y":"0.0000"},{"t":1566187200,"x":"19/08/2019","y":"0.1314"},{"t":1566532800,"x":"23/08/2019","y":"0.2619"},{"t":1566964800,"x":"28/08/2019","y":"0.4112"},{"t":1567310400,"x":"01/09/2019","y":"0.5306"},{"t":1567656000,"x":"05/09/2019","y":"0.6519"},{"t":1568088000,"x":"10/09/2019","y":"0.7483"},{"t":1568433600,"x":"14/09/2019","y":"0.8480"},{"t":1568779200,"x":"18/09/2019","y":"0.9383"},{"t":1569211200,"x":"23/09/2019","y":"1.0528"},{"t":1569556800,"x":"27/09/2019","y":"1.1500"},{"t":1569902400,"x":"01/10/2019","y":"1.2258"},{"t":1570334400,"x":"06/10/2019","y":"1.3326"},{"t":1570680000,"x":"10/10/2019","y":"1.3775"},{"t":1571025600,"x":"14/10/2019","y":"1.4602"},{"t":1571457600,"x":"19/10/2019","y":"1.5597"},{"t":1571803200,"x":"23/10/2019","y":"1.6405"},{"t":1572235200,"x":"28/10/2019","y":"1.7344"},{"t":1572580800,"x":"01/11/2019","y":"1.8073"},{"t":1572930000,"x":"05/11/2019","y":"1.8836"},{"t":1573275600,"x":"09/11/2019","y":"1.9432"}],"endpoint":"https://defiportfolio-backend.herokuapp.com/api/v1/markets/fulcrum/dai?start_date=1565866741"},{"id":"Idle",'pos':2,"icon":"idle-mark.png","color":"hsl(227, 100%, 50%)","aprs":[{"t":1565841600,"x":"15/08/2019","y":12.0012999748,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1565841600,"x":"15/08/2019","y":12.0012999748,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566187200,"x":"19/08/2019","y":11.9071898338,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566532800,"x":"23/08/2019","y":10.9043702637,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1566964800,"x":"28/08/2019","y":10.898848905,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1567310400,"x":"01/09/2019","y":11.0713746174,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1567656000,"x":"05/09/2019","y":7.0411276517,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568088000,"x":"10/09/2019","y":9.0967959005,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568433600,"x":"14/09/2019","y":8.2304366531,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1568779200,"x":"18/09/2019","y":8.3610064414,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569211200,"x":"23/09/2019","y":8.8595258625,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569556800,"x":"27/09/2019","y":6.9153156339,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1569902400,"x":"01/10/2019","y":8.1846270271,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1570334400,"x":"06/10/2019","y":7.7331059741,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1570680000,"x":"10/10/2019","y":7.4281545568,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1571025600,"x":"14/10/2019","y":7.2633040984,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1571457600,"x":"19/10/2019","y":7.3153018689,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1571803200,"x":"23/10/2019","y":6.8672401353,"address":"0xf5dce57282a584d2746faf1593d3121fcac444dc"},{"t":1572235200,"x":"28/10/2019","y":6.6498551182,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1572580800,"x":"01/11/2019","y":6.8810257801,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1572930000,"x":"05/11/2019","y":5.4327273052,"address":"0x14094949152eddbfcd073717200da82fed8dc960"},{"t":1573275600,"x":"09/11/2019","y":5.1890604418,"address":"0x14094949152eddbfcd073717200da82fed8dc960"}],"data":[{"t":1565841600,"x":"15/08/2019","y":"0.0000"},{"t":1565841600,"x":"15/08/2019","y":"0.0000"},{"t":1566187200,"x":"19/08/2019","y":"0.1314"},{"t":1566532800,"x":"23/08/2019","y":"0.2619"},{"t":1566964800,"x":"28/08/2019","y":"0.4112"},{"t":1567310400,"x":"01/09/2019","y":"0.5306"},{"t":1567656000,"x":"05/09/2019","y":"0.6519"},{"t":1568088000,"x":"10/09/2019","y":"0.7483"},{"t":1568433600,"x":"14/09/2019","y":"0.8480"},{"t":1568779200,"x":"18/09/2019","y":"0.9383"},{"t":1569211200,"x":"23/09/2019","y":"1.0528"},{"t":1569556800,"x":"27/09/2019","y":"1.1500"},{"t":1569902400,"x":"01/10/2019","y":"1.2258"},{"t":1570334400,"x":"06/10/2019","y":"1.3380"},{"t":1570680000,"x":"10/10/2019","y":"1.4228"},{"t":1571025600,"x":"14/10/2019","y":"1.5042"},{"t":1571457600,"x":"19/10/2019","y":"1.6038"},{"t":1571803200,"x":"23/10/2019","y":"1.6840"},{"t":1572235200,"x":"28/10/2019","y":"1.7782"},{"t":1572580800,"x":"01/11/2019","y":"1.8512"},{"t":1572930000,"x":"05/11/2019","y":"1.9275"},{"t":1573275600,"x":"09/11/2019","y":"1.9871"}]}];
    let minValue;
    let maxValue;
    let days = this.getGraphDays(graphData);
    [minValue,maxValue] = this.getGraphDataMinMax(graphData);
    this.setState({
      graphData,
      minValue,
      maxValue,
      days
    });
  }

  async getEquity(){
    let graphData = await this.getAprs();

    let minValue = null;
    let maxValue = null;

    graphData.forEach((v,i) => {
      let balance = this.state.initialBalance;
      let lastBalance = balance;
      let lastAprInfo = null;
      v.aprs.forEach((aprInfo,j) => {
        let totalEarned = 0;
        if (j){
          // Calculate earnings between 2 segments
          const apr = lastAprInfo.y;
          const earningPerYear = balance*(apr/100);
          const earningPerSecond = earningPerYear/this.state.secondsInYear;
          const secondsPassed = aprInfo.t-lastAprInfo.t;
          totalEarned = secondsPassed*earningPerSecond;
          // console.log(v.id,moment(aprInfo.t*1000).format('DD/MM/YYYY'),moment(lastAprInfo.t*1000).format('DD/MM/YYYY'),apr,earningPerYear,earningPerSecond,secondsPassed,totalEarned);
          balance += totalEarned;
        }
        graphData[i].data.push({
          t:aprInfo.t,
          x:aprInfo.x,
          y:((balance-this.state.initialBalance)*10).toFixed(4)
          // y:balance.toFixed(4)
        });
        lastBalance = balance;
        lastAprInfo = aprInfo;
      });

      // maxValue = maxValue ? Math.max(maxValue,balance) : balance;
    });

    // const startTimestamp = parseInt(moment('01/09/2019','DD/MM/YYYY')._d.getTime()/1000);
    // graphData = this.filterGraphData(graphData,startTimestamp);
    [minValue,maxValue] = this.getGraphDataMinMax(graphData);
    let days = this.getGraphDays(graphData);

    this.setState({
      graphData,
      minValue,
      maxValue,
      days
    });
  }

  async makeCachedRequest(endpoint,TTL){
    const timestamp = parseInt(new Date().getTime()/1000);
    if (localStorage) {
      // Check if already exists
      let res = localStorage.getItem(endpoint);

      if (res){
        res = JSON.parse(res);
        // Check if it's not expired
        if (res.timestamp && timestamp-res.timestamp<TTL){
          return res.data;
        }
      }
    }

    const data = await axios.get(endpoint);
    if (localStorage) {
      localStorage.setItem(endpoint,JSON.stringify({
        data,
        timestamp
      }));
    }
    return data;
  }

  async getAprs() {
    // const timeMonthAgo = parseInt(new Date().getTime()/1000)-(60*60*24*31*6);
    // const timeWeekAgo = parseInt(new Date().getTime()/1000)-(60*60*24*7);
    // const graphStartTimestamp = 0; // All data
    // const graphStartTimestamp = timeMonthAgo;
    const graphStartTimestamp = 1565866741; // First Idle block mined
    // const graphStartTimestamp = 1557720000; // First Fulcrum block mined
    // const graphStartTimestamp = 1563187879; // 14/07/2019
    // const graphStartTimestamp = parseInt(moment('01/08/2019','DD/MM/YYYY')._d.getTime()/1000);
    const graphData = [
      {
        "id": "Compound",
        'pos':1,
        'address' : cDAIAddress,
        'icon' : 'compound-mark-green.png',
        "color": "hsl(162, 100%, 41%)",
        "aprs": [],
        "data": [],
        'endpoint':'https://defiportfolio-backend.herokuapp.com/api/v1/markets/compound_v2/dai?start_date='+graphStartTimestamp
      },
      {
        "id": "Fulcrum",
        'pos':3,
        'address' : iDAIAddress,
        'icon' : 'fulcrum-mark.png',
        "color": "hsl(197, 98%, 38%)",
        "aprs": [],
        "data": [],
        'endpoint':'https://defiportfolio-backend.herokuapp.com/api/v1/markets/fulcrum/dai?start_date='+graphStartTimestamp
      }/*,
      {
        "id": "DyDx",
        'address' : '0x000000000000000000000',
        'icon' : 'dydx-mark.png',
        "color": "hsl(210, 13%, 18%)",
        "aprs": [],
        "data": [],
        'endpoint':'https://defiportfolio-backend.herokuapp.com/api/v1/markets/dydx/dai?start_date='+graphStartTimestamp
      }*/
    ];

    let maxLen = 0;

    const loadGraphData = async () => {
      await this.asyncForEach(graphData, async (info,key) => {
        if (info.endpoint){
          let remote_data = await this.makeCachedRequest(info.endpoint,43200);

          if (!remote_data || !remote_data.data) {
            return;
          }

          remote_data = remote_data.data;

          maxLen = Math.max(maxLen,remote_data.chart.length);
          remote_data.chart.forEach((v,i) => {
            const date = moment(v.timestamp*1000).format('DD/MM/YYYY');
            const timestamp = getDayTimestamp(v.timestamp*1000);
            const rate = v.supply_rate;

            graphData[key].aprs.push({t:timestamp,x:date,y:rate});
          });
        }

        // Sort the array by Date
        graphData[key].aprs.sort(function(a,b){
          return moment(a.x,'DD/MM/YYYY')._d - moment(b.x,'DD/MM/YYYY')._d;
        });

      });
    }

    const getProtocolByAddress = (address) => {
      let output = null;
      graphData.forEach((v,i) => {
        if (v.address === address){
          output = v;
          return false;
        }
      });
      return output;
    }

    const getProtocolDataByAddress = (address) => {
      let output = null;
      graphData.forEach((v,i) => {
        if (v.address === address){
          output = v.aprs;
          return false;
        }
      });
      return output;
    }

    const getDayTimestamp = (timestamp) => {
      return parseInt(moment(moment(timestamp).format('DD/MM/YYYY'),'DD/MM/YYYY')._d.getTime()/1000);
    }

    const getClosestProtocolAprByTimestamp = (address,timestamp,maxTimestamp) => {
      let output = null;
      const protocolData = getProtocolDataByAddress(address);
      protocolData.forEach((apr,i) => {
        const baseTimestamp = getDayTimestamp(apr.t*1000);
        if (!output && baseTimestamp>=parseInt(timestamp) && (!maxTimestamp || baseTimestamp<=parseInt(maxTimestamp))){
          output = apr;
          output.address = address;
          // console.log(address,moment(timestamp*1000).format('DD/MM/YYYY'),moment(baseTimestamp*1000).format('DD/MM/YYYY'),baseTimestamp>=parseInt(timestamp),apr.y);
          return true;
        }
      });
      return output;
    };

    const getHighestAprByTimestamp = (timestamp,maxTimestamp) => {
      let maxApr = null;
      graphData.forEach((v,i) => {
        if (v.address){
          const apr = getClosestProtocolAprByTimestamp(v.address,timestamp,maxTimestamp);
          if (apr){
            // console.log('Find Apr ',v.address,moment(timestamp*1000).format('DD/MM/YYYY'),moment(maxTimestamp*1000).format('DD/MM/YYYY'),apr.y);
            if (!maxApr || apr.y>maxApr.y){
              maxApr = apr;
            }
          }
        }
      });
      return maxApr;
    };

    await loadGraphData();

    const internalTxs = await this.getContractTransactions();

    if (!internalTxs){
      return false;
    }

    // Get Aprs
    const idleData = [];

    // Load missing days
    const firstTxTimestamp = internalTxs[0].timeStamp;
    // const missingDays = parseInt((firstTxTimestamp-graphStartTimestamp)/60*60*24);

    let timestamp = graphStartTimestamp-60*60*24;
    for (timestamp;timestamp<firstTxTimestamp;timestamp+=60*60*24){
      // console.log('Find missing days',moment(timestamp*1000).format('DD/MM/YYYY'));
      const apr = getHighestAprByTimestamp(timestamp,timestamp+=60*60*24);
      if (apr){
        // console.log('Highest Apr',moment(timestamp*1000).format('DD/MM/YYYY'),apr.y);
        idleData.push(apr);
        timestamp = apr.t;
      }
    }

    // Group transaction by BlockTime
    const idleBlocks = {};
    internalTxs.forEach((v,i) => {
      if (v.to === cDAIAddress || v.to === iDAIAddress){
        const txTimestamp = parseInt(v.timeStamp)*1000;
        const m = moment(txTimestamp);
        const blockDate = m.format('DD/MM/YYYY');
        const blockTime = getDayTimestamp(txTimestamp);
        idleBlocks[blockTime] = {
          to:v.to,
          timeStamp:blockTime,
          date:blockDate
        };
      }
    });

    const idleBlocksOrdered = {};
    Object.keys(idleBlocks).sort().forEach(function(key) {
      idleBlocksOrdered[key] = idleBlocks[key];
    });

    // Get Aprs based by rebalancing 
    const blockTimes = Object.keys(idleBlocksOrdered);
    let nextTimestamp = null;
    blockTimes.forEach((blockTime,i) => {
      if (blockTime<=nextTimestamp){
        return;
      }

      const tx = idleBlocksOrdered[blockTime];

      // Set the max timestamp to look for
      const nextBlockTime = blockTimes[i+1];
      const nextTx = nextBlockTime ? idleBlocksOrdered[nextBlockTime] : null;
      const maxTimestamp = nextTx ? nextTx.timeStamp : null;
      const apr = getClosestProtocolAprByTimestamp(tx.to,blockTime,maxTimestamp);

      if (apr){
        idleData.push(apr);

        nextTimestamp = apr.t;

        const protocolID = getProtocolByAddress(apr.address).id;
        const latestIdleApr = idleData.length>1 ? idleData[idleData.length-2] : null;

        // console.log(moment(blockTime*1000).format('DD/MM/YYYY'),moment(apr.t*1000).format('DD/MM/YYYY'),protocolID,apr.y);

        // Check if skipped some days between last and current apr
        if (latestIdleApr){
          const lastTimestamp = latestIdleApr.t;
          const timestampDiff = apr.t-latestIdleApr.t;
          const secondsPerDay = 60*60*24;
          const daysBetweenTimestamps = parseInt(timestampDiff/secondsPerDay)-1;

          if (daysBetweenTimestamps>1){
            let timestamp = lastTimestamp+secondsPerDay;
            for (timestamp;timestamp<blockTime;timestamp+=secondsPerDay){
              const maxTimestamp = timestamp+secondsPerDay;
              const apr = getClosestProtocolAprByTimestamp(latestIdleApr.address,timestamp,maxTimestamp);
              if (apr){
                // console.log('Filling skipped day',getProtocolByAddress(latestIdleApr.address).id,moment(timestamp*1000).format('DD/MM/YYYY'),' => ',moment(apr.t*1000).format('DD/MM/YYYY'),getProtocolByAddress(latestIdleApr.address).id,apr.y);
                idleData.push(apr);
                timestamp = apr.t;
              }
            }
          }
        }

        idleData.sort(function(a,b){
          return moment(a.x,'DD/MM/YYYY')._d - moment(b.x,'DD/MM/YYYY')._d;
        });
      }
    });

    graphData.push(
      {
        "id": "Idle",
        'pos':2,
        'icon' : 'idle-mark.png',
        "color": "hsl(227, 100%, 50%)",
        "aprs": idleData,
        "data": []
      }
    );

    return graphData;
  }

  render() {
    const MyResponsiveLine = (data,interestBoxes) => (
      <Flex width={'100%'} flexDirection={'column'}>
        <Heading.h4 fontSize={[2,2]} py={[2,3]} px={[3,0]} textAlign={'center'} fontWeight={2} lineHeight={1.5} color={'dark-gray'}>
          These are the interest you would earn by lending <strong>{this.state.initialBalance} DAI</strong> for <strong>{this.state.days} days</strong>.
        </Heading.h4>
        <Flex width={'100%'} flexDirection={['column','row']} mt={[2,3]}>
          { interestBoxes }
        </Flex>
        <ResponsiveLine
            data={data}
            margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
            xScale={{
              type: 'time',
              format: '%d/%m/%Y',
              precision: 'day'
            }}
            curve="catmullRom"
            xFormat="time:%d/%m/%Y"
            // yScale={{
            //   type: 'log',
            //   base: 10,
            //   max: 'auto',
            // }}
            yScale={{
              type: 'linear',
              stacked: false,
              // min: this.state.minValue,
              // max: this.state.maxValue,
            }}
            axisLeft={{
              legend: 'Interest earned',
              legendOffset: -40,
              legendPosition: 'middle'
            }}
            axisBottom={{
              format: '%b %d',
              // tickValues: 'every 2 days',
              // tickValues: 'every 13 days',
              // legend: 'TIME',
              legendOffset: 36,
              legendPosition: 'middle'

            }}
            yFormat={value =>
              parseFloat(value).toFixed(2)+' DAI'
            }
            enableGridX={false}
            enableGridY={false}
            colors={d => d.color}
            pointSize={5}
            pointColor={{ from: 'color', modifiers: [] }}
            pointBorderWidth={1}
            pointLabel="y"
            pointLabelYOffset={-12}
            enableSlices="x"
            useMesh={true}
            animate={false}
            legends={[
                {
                    anchor: 'bottom-right',
                    direction: 'column',
                    justify: false,
                    translateX: 100,
                    translateY: 0,
                    itemsSpacing: 0,
                    itemDirection: 'left-to-right',
                    itemWidth: 80,
                    itemHeight: 20,
                    itemOpacity: 0.75,
                    symbolSize: 12,
                    symbolShape: 'circle',
                    symbolBorderColor: 'rgba(0, 0, 0, .5)',
                    effects: [
                        {
                            on: 'hover',
                            style: {
                                itemBackground: 'rgba(0, 0, 0, .03)',
                                itemOpacity: 1
                            }
                        }
                    ]
                }
            ]}
        />
      </Flex>
    )

    if (this.state.graphData){

      const graphData = this.state.graphData;
      graphData.sort(function(a,b){
        return a.pos - b.pos;
      });

      const interestBoxes = graphData.map(v=>{
        const isIdle = v.id==='Idle';
        const interestEarned = parseFloat(v.data[v.data.length-1].y);
        const finalBalance = this.state.initialBalance+interestEarned;
        const percentageEarned = (finalBalance/this.state.initialBalance-1);
        const secondsPassed = parseInt(v.data[v.data.length-1].t)-parseInt(v.data[0].t);
        const percentageEarnedPerSecond = percentageEarned/secondsPassed;
        const interestEarnedPerSecond = interestEarned/secondsPassed;
        const finalBalanceAfterYear = this.state.initialBalance+(interestEarnedPerSecond*this.state.secondsInYear);
        const annualReturn = parseFloat((finalBalanceAfterYear/this.state.initialBalance-1)*10).toFixed(2);
        // console.log(v.id,moment(v.data[0].t*1000).format('DD/MM/YYYY'),moment(v.data[v.data.length-1].t*1000).format('DD/MM/YYYY'),interestEarned,finalBalance,percentageEarned,secondsPassed,interestEarnedPerSecond,finalBalanceAfterYear,annualReturn);
        return (
          <Flex key={'graph_'+v.id} width={[1,1/3]} mx={[0,2]} flexDirection={'column'}>
            <Box>
              <Card my={[2,2]} py={3} px={0} borderRadius={'10px'} boxShadow={ isIdle ? 1 : 1 } className={isIdle ? styles.gradientBg : null}>
                <Flex flexDirection={'row'} alignItems={'center'}>
                  <Flex width={3/12} borderRight={'1px solid #eee'} justifyContent={'center'}>
                    <Image src={`images/${v.icon}`} height={['1.3em', '2em']} verticalAlign={'middle'} />
                  </Flex>
                  <Box width={6/12} borderRight={'1px solid #eee'}>
                    <Text color={isIdle ? 'white' : 'copyColor'} fontSize={[4,5]} fontWeight={4} textAlign={'center'}>
                      {interestEarned.toFixed(3)} <Text.span color={isIdle ? 'white' : 'copyColor'} fontWeight={2} fontSize={['90%','60%']}>DAI</Text.span>
                    </Text>
                  </Box>
                  <Flex alignItems={'center'} flexDirection={'column'} width={3/12}>
                    <Text.span color={isIdle ? 'white' : 'copyColor'} fontWeight={2} fontSize={['90%','70%']}>APR</Text.span>
                    <Text lineHeight={1} pl={'10px'} color={isIdle ? 'white' : 'copyColor'} fontSize={[3,3]} fontWeight={3} textAlign={'center'}>
                      {annualReturn}<Text.span color={isIdle ? 'white' : 'copyColor'} fontWeight={3} fontSize={['90%','70%']}>%</Text.span>
                    </Text>
                  </Flex>
                </Flex>
              </Card>
            </Box>
          </Flex>
        )
      });
      return MyResponsiveLine(this.state.graphData,interestBoxes);
    } else {
      return null;
    }
  }
}

export default EquityChart;