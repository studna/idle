import styles from './SmartContractControls.module.scss';
import React from "react";
import { Form, Flex, Box, Heading, Text, Button, Link, Icon, Pill, Loader, Flash } from "rimble-ui";
import BigNumber from 'bignumber.js';
import CryptoInput from '../CryptoInput/CryptoInput.js';
import ApproveModal from "../utilities/components/ApproveModal";
import WelcomeModal from "../utilities/components/WelcomeModal";
import MaxCapModal from "../utilities/components/MaxCapModal";
import axios from 'axios';
import moment from 'moment';
import CountUp from 'react-countup';

import IdleDAI from "../contracts/IdleDAI.json";
import cDAI from '../abis/compound/cDAI';
import DAI from '../contracts/IERC20.json';
import iDAI from '../abis/fulcrum/iToken.json';

const env = process.env;

// mainnet
const IdleAbi = IdleDAI.abi;
const OldIdleAddress = '0x10cf8e1CDba9A2Bd98b87000BCAdb002b13eA525'; // v0.1 hackathon version
const IdleAddress = '0xAcf651Aad1CBB0fd2c7973E2510d6F63b7e440c9';

const cDAIAbi = cDAI.abi;
const cDAIAddress = '0xf5dce57282a584d2746faf1593d3121fcac444dc';
const DAIAbi = DAI.abi;
const DAIAddress = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';
const iDAIAbi = iDAI.abi;
const iDAIAddress = '0x14094949152eddbfcd073717200da82fed8dc960';

class SmartContractControls extends React.Component {
  state = {
    iDAIRate: 0,
    cDAIRate: 0,
    cDAIToRedeem: 0,
    partialRedeemEnabled: false,
    disableLendButton: false,
    disableRedeemButton: false,
    welcomeIsOpen: false,
    approveIsOpen: false,
    capReached: false,
    showFundsInfo:false,
    isApprovingDAITest: true,
    redeemProcessing: false,
    lendingProcessing: false,
    tokenName: 'DAI',
    baseTokenName: 'DAI',
    lendAmount: '',
    redeemAmount: '',
    needsUpdate: false,
    genericError: null,
    selectedTab: '1',
    amountLent: null,
    IdleDAISupply: null,
    idleDAICap: 30000,
    earning: null,
    earningIntervalId: null,
    earningPerYear: null,
    maxRate: '-',
    calculataingShouldRebalance: true,
    fundsTimeoutID: null,
    prevTxs : {}
  };

  // utilities
  trimEth = (eth,decimals) => {
    decimals = !isNaN(decimals) ? decimals : 6;
    return this.BNify(eth).toFixed(decimals);
  };
  BNify = s => new BigNumber(String(s));
  toEth(wei) {
    return this.props.web3.utils.fromWei(
      (wei || 0).toString(),
      "ether"
    );
  }
  toWei(eth) {
    return this.props.web3.utils.toWei(
      (eth || 0).toString(),
      "ether"
    );
  }
  rebalanceCheck = async () => {

    this.setState({calculataingShouldRebalance:true});

    const res = await this.genericIdleCall('rebalanceCheck');
    if (!res || !Object.keys(res).length){
      return false;
    }

    this.setState({
      calculataingShouldRebalance: false,
      shouldRebalance: res[0],
      needsUpdate: false
    });
  };
  animateMaxRate = (start = 0, end = null, duration = 1000) => {
    end = parseFloat(parseFloat(end).toFixed(2));
    const minStep = 0.13;
    const steps = (end-start)/minStep;
    const stepTime = Math.ceil(duration/steps);
    let timer = null;

    const run = () => {
      const newRate = Math.min(parseFloat(this.state.maxRate)+minStep,end);
      this.setState({maxRate:parseFloat(newRate).toFixed(2)});
      if (newRate === end){
        window.clearInterval(timer);
      }
    }

    timer = window.setInterval(run,stepTime);
  };
  toggleShowFundsInfo = (e) => {
    e.preventDefault();
    this.setState(state => ({
      ...state,
      showFundsInfo: !state.showFundsInfo
    }));
  }
  togglePartialRedeem = () => {
    this.setState(state => ({
      ...state,
      partialRedeemEnabled: !state.partialRedeemEnabled
    }));
  };
  getAprs = async () => {
    const aprs = await this.genericIdleCall('getAPRs');
    if (!aprs){
      this.setState({
        needsUpdate: true
      });
      return false;
    }
    // console.log('getAprs',aprs);
    const maxRate = this.toEth(Math.max(aprs[0],aprs[1]));
    let currentProtocol = false;
    if (aprs){
      currentProtocol = aprs[0]>aprs[1] ? 'Compound' : 'Fulcrum';
    }
    // const startMaxRate = parseFloat(parseFloat(maxRate*0.5).toFixed(2));
    this.setState({
      [`compoundRate`]: aprs ? (+this.toEth(aprs[0])).toFixed(2) : '0.00',
      [`fulcrumRate`]: aprs ? (+this.toEth(aprs[1])).toFixed(2) : '0.00',
      [`maxRate`]: aprs ? ((+maxRate).toFixed(2)) : '0.00',
      currentProtocol: currentProtocol,
      needsUpdate: false
    });
    // this.animateMaxRate(startMaxRate,maxRate);
  };
  getPriceInToken = async (contractName) => {
    const totalIdleSupply = await this.genericContractCall(contractName, 'totalSupply');
    let price = await this.genericContractCall(contractName, 'tokenPrice');
    const navPool = this.BNify(totalIdleSupply).div(1e18).times(this.BNify(price).div(1e18));
    this.setState({
      IdleDAIPrice: (totalIdleSupply || totalIdleSupply === 0) && totalIdleSupply.toString() === '0' ? 0 : (+this.toEth(price)),
      navPool: navPool,
      needsUpdate: false
    });
    return price;
  };
  getTotalSupply = async (contractName) => {
    const totalSupply = await this.genericContractCall(contractName, 'totalSupply');
    this.setState({
      [`${contractName}Supply`]: totalSupply,
      needsUpdate: false
    });
    return totalSupply;
  };
  getOldPriceInToken = async (contractName) => {
    const totalIdleSupply = await this.genericContractCall(contractName, 'totalSupply');
    let price = await this.genericContractCall(contractName, 'tokenPrice');
    this.setState({
      [`OldIdleDAIPrice`]: (totalIdleSupply || totalIdleSupply === 0) && totalIdleSupply.toString() === '0' ? 0 : (+this.toEth(price)),
      needsUpdate: false
    });
    return price;
  };
  getBalanceOf = async contractName => {
    let price = await this.getPriceInToken(contractName);
    let balance = await this.genericContractCall(contractName, 'balanceOf', [this.props.account]);
    if (balance) {
      balance = this.BNify(balance).div(1e18);
      price = this.BNify(price).div(1e18);
      const tokenToRedeem = balance.times(price);
      let earning = 0;
      if (this.trimEth(tokenToRedeem.toString())>0 && this.state.amountLent){
        earning = tokenToRedeem.minus(this.BNify(this.state.amountLent));
      }

      const redirectToFundsAfterLogged = localStorage ? parseInt(localStorage.getItem('redirectToFundsAfterLogged')) : true;

      // Select seconds Tab
      if (balance.gt(0) && !this.state.DAIToRedeem && redirectToFundsAfterLogged){
        this.selectTab({ preventDefault:()=>{} },'2');
      }

      if (localStorage){
        localStorage.removeItem('redirectToFundsAfterLogged');
      }

      const currentApr = this.BNify(this.state.maxRate).div(100);
      const earningPerYear = tokenToRedeem.times(currentApr);

      // console.log('getBalanceOf',balance,balance.gt(0),tokenToRedeem,this.state.amountLent,earning,currentApr,earningPerYear);

      this.setState({
        [`balanceOf${contractName}`]: balance,
        [`DAIToRedeem`]: tokenToRedeem.toString(),
        currentApr,
        tokenToRedeem,
        earning,
        earningPerYear,
        needsUpdate: false
      });
    }

    return balance;
  };

  animateCurrentEarnings = (count) => {
    count = !isNaN(count) ? count : 1;
    if (!this.state.tokenToRedeem){
      if (count<=3){
        window.setTimeout(()=>{this.animateCurrentEarnings(count+1)},500);
      }
      return false;
    }
    const currentApr = this.BNify(this.state.maxRate).div(100);
    const currentBalance = this.BNify(this.state.tokenToRedeem);
    const earningPerYear = currentBalance.times(currentApr);
    const secondsInYear = this.BNify(31536000); // Seconds in a Year
    // const blocksPerYear = this.BNify(2336000); // Blocks per year
    let minEarningPerInterval = this.BNify(0.000000001);
    // let earningPerSecond = earningPerYear.div(secondsInYear);
    let earningPerInterval = earningPerYear.div(secondsInYear);
    let interval = 10;
    if (interval<1000){
      earningPerInterval = earningPerInterval.div((1000/interval));
    }

    if (earningPerInterval<minEarningPerInterval){
      const times = minEarningPerInterval.div(earningPerInterval).toFixed(3);
      earningPerInterval = minEarningPerInterval;
      interval *= times;
    }

    interval = Math.floor(interval);

    if (this.state.earningIntervalId){
      window.clearInterval(this.state.earningIntervalId);
    }

    const earningIntervalId = window.setInterval(() => {
      if (this.state.tokenToRedeem && this.state.earning && earningPerInterval){
        const newTokenToRedeem = this.state.tokenToRedeem.plus(earningPerInterval);
        const newEarning = this.state.earning.plus(earningPerInterval);
        this.setState({
          DAIToRedeem:newTokenToRedeem.toString(),
          tokenToRedeem:newTokenToRedeem,
          earning:newEarning
        });
      }
    },interval);

    this.setState({
      earningIntervalId,
      earningPerYear
    });
  };

  getOldBalanceOf = async contractName => {
    let price = await this.getOldPriceInToken(contractName);
    let balance = await this.genericContractCall(contractName, 'balanceOf', [this.props.account]);
    if (balance) {
      balance = this.BNify(balance).div(1e18);
      price = this.BNify(price).div(1e18);
      const tokenToRedeem = balance.times(price);
      let earning = 0;

      if (this.state.amountLent){
        earning = tokenToRedeem.minus(this.BNify(this.state.amountLent));
      }
      this.setState({
        [`balanceOf${contractName}`]: balance,
        [`oldDAIToRedeem`]: tokenToRedeem.toString(),
        oldEarning: earning,
        needsUpdate: false
      });
    }
    return balance;
  };

  // should be called with DAI contract as params
  getAllowance = async contractName => {
    let allowance = await this.genericContractCall(
      contractName, 'allowance', [this.props.account, IdleAddress]
    );
    if (allowance) {
      this.setState({
        [`${contractName}Allowance`]: allowance
      });
    }
    return allowance;
  };
  genericContractCall = async (contractName, methodName, params = []) => {
    let contract = this.props.contracts.find(c => c.name === contractName);
    contract = contract && contract.contract;
    if (!contract) {
      console.log('Wrong contract name', contractName);
      return;
    }

    const value = await contract.methods[methodName](...params).call().catch(error => {
      console.log(`${contractName} contract method ${methodName} error: `, error);
      this.setState({ error });
    });
    return value;
  }

  // Idle
  genericIdleCall = async (methodName, params = []) => {
    return await this.genericContractCall('IdleDAI', methodName, params).catch(err => {
      console.error('Generic Idle call err:', err);
    });
  }

  disableERC20 = (e, name) => {
    e.preventDefault();
    // No need for callback atm
    this.props.contractMethodSendWrapper(name, 'approve', [
      IdleAddress,
      0 // Disapprova
    ],null,(tx)=>{
      this.setState({
        [`isApproving${name}`]: false, // TODO when set to false?
      });
    });

    this.setState({
      [`isApproving${name}`]: true, // TODO when set to false?
      approveIsOpen: false
    });
  };

  enableERC20 = (e, name) => {
    e.preventDefault();
    // No need for callback atm
    this.props.contractMethodSendWrapper(name, 'approve', [
      IdleAddress,
      this.props.web3.utils.toTwosComplement('-1') // max uint solidity
      // this.props.web3.utils.BN(0) // Disapprova
    ],null,(tx)=>{
      this.setState({
        [`isApproving${name}`]: false, // TODO when set to false?
      });
    });

    this.setState({
      [`isApproving${name}`]: true, // TODO when set to false?
      approveIsOpen: false
    });
  };

  rebalance = e => {
    e.preventDefault();

    this.setState(state => ({
      ...state,
      rebalanceProcessing: this.props.account ? true : false
    }));

    this.props.contractMethodSendWrapper('IdleDAI', 'rebalance', [], null , (tx) => {
      this.setState({
        needsUpdate: true,
        rebalanceProcessing: false
      });
    });
  };
  mint = async (e, contractName) => {
    if (this.state[`isApprovingDAI`]){
      return false;
    }

    e.preventDefault();
    if (this.props.account && !this.state.lendAmount) {
      return this.setState({genericError: 'Insert a DAI amount to lend'});
    }

    const value = this.props.web3.utils.toWei(
      this.state.lendAmount || '0',
      "ether"
    );

    const IdleDAISupply = this.BNify(this.state.IdleDAISupply).div(1e18);
    const IdleDAIPrice = this.BNify(this.state.IdleDAIPrice);
    const toMint = this.BNify(value).div(1e18).div(IdleDAIPrice);
    const newTotalSupply = toMint.plus(IdleDAISupply);
    const idleDAICap = this.BNify(this.state.idleDAICap);

    if (this.props.account && newTotalSupply.gt(idleDAICap)) {
      this.setState({capReached: true});
      return;
    }

    // check if Idle is approved for DAI
    if (this.props.account && !this.state[`isApprovingDAI`]) {
      const allowance = await this.getAllowance('DAI'); // DAI
      if (this.BNify(allowance).lt(this.BNify(value.toString()))) {
        return this.setState({approveIsOpen: true});
      }
    }

    if (localStorage){
      localStorage.setItem('redirectToFundsAfterLogged',0);
    }

    // No need for callback atm
    this.props.contractMethodSendWrapper('IdleDAI', 'mintIdleToken', [
      value
    ], null, (tx) => {
      const needsUpdate = tx.status === 'success';
      if (needsUpdate){
        this.selectTab({ preventDefault:()=>{} },'2');
      }
      this.setState({
        lendingProcessing: false,
        [`isLoading${contractName}`]: false,
        needsUpdate: needsUpdate,
      });
    });

    this.setState({
      [`isLoading${contractName}`]: false,
      lendingProcessing: true,
      lendAmount: '',
      genericError: '',
      needsUpdate: true
    });
  };

  redeem = async (e, contractName) => {
    e.preventDefault();

    this.setState(state => ({
      ...state,
      [`isLoading${contractName}`]: true,
      redeemProcessing: true
    }));

    let IdleDAIBalance = this.toWei('0');
    if (this.props.account) {
      IdleDAIBalance = await this.genericContractCall(contractName, 'balanceOf', [this.props.account]);
    }

    if (this.state.partialRedeemEnabled && this.BNify(this.state.redeemAmount).lte(this.BNify(this.state.balanceOfIdleDAI)) ){
      IdleDAIBalance = this.props.web3.utils.toWei(
        this.state.redeemAmount || '0',
        "ether"
      );
    }

    // console.log('redeem',IdleDAIBalance);

    this.props.contractMethodSendWrapper(contractName, 'redeemIdleToken', [
      IdleDAIBalance
    ], null, (tx) => {
      this.setState({
        [`isLoading${contractName}`]: false,
        needsUpdate: true,
        redeemProcessing: false
      });
    });
  };

  useEntireBalanceRedeem = (balance) => {
    // this.setState({ redeemAmount: balance.toString() });
    this.handleChangeAmountRedeem({
      target:{
        value: balance.toString()
      }
    });
  }

  useEntireBalance = (balance) => {
    // this.setState({ lendAmount: balance.toString() });
    this.handleChangeAmount({
      target:{
        value: balance.toString()
      }
    });
  }

  handleChangeAmountRedeem = (e) => {
    if (this.props.account){
      let amount = e.target.value;
      console.log('handleChangeAmountRedeem',amount,this.state.balanceOfIdleDAI);
      this.setState({ redeemAmount: amount });

      let disableRedeemButton = false;
      let genericError = '';

      if (this.props.account) {
        if (this.BNify(amount).gt(this.BNify(this.state.balanceOfIdleDAI))){
          disableRedeemButton = true;
          genericError = 'The inserted amount exceeds your Redeemable balance';
        } else if (this.BNify(amount).lte(0)) {
          disableRedeemButton = true;
          genericError = 'Please insert a positive amount';
        }
      }

      return this.setState({
        disableRedeemButton,
        genericError
      });
    } else {
      this.redeem(e);
    }
  };

  handleChangeAmount = (e) => {
    if (this.props.account){
      let amount = e.target.value;
      this.setState({ lendAmount: amount });

      let disableLendButton = false;
      let genericError = '';

      if (this.props.account) {
        if (this.BNify(amount).gt(this.BNify(this.props.accountBalanceDAI))){
          disableLendButton = true;
          genericError = 'The inserted amount exceeds your DAI balance';
        } else if (this.BNify(amount).lte(0)) {
          disableLendButton = true;
          genericError = 'Please insert a positive amount';
        }
      }

      return this.setState({
        disableLendButton,
        genericError
      });
    } else {
      this.mint(e);
    }
  };
  toggleModal = (e) => {
    this.setState(state => ({...state, approveIsOpen: !state.approveIsOpen }));
  };
  toggleMaxCapModal = (e) => {
    this.setState(state => ({...state, capReached: !state.capReached }));
  };
  toggleWelcomeModal = (e) => {
    this.setState(state => ({...state, welcomeIsOpen: !state.welcomeIsOpen }));
  };

  getPrevTxs = async (executedTxs) => {
    const txs = await axios.get(`
      https://api.etherscan.io/api?module=account&action=tokentx&address=${this.props.account}&startblock=8119247&endblock=999999999&sort=asc&apikey=${env.REACT_APP_ETHERSCAN_KEY}
    `).catch(err => {
      console.log('Error getting prev txs');
    });
    if (!txs || !txs.data || !txs.data.result) {
      return;
    }

    const results = txs.data.result;
    const prevTxs = results.filter(
        tx => tx.to.toLowerCase() === IdleAddress.toLowerCase() ||
              tx.from.toLowerCase() === IdleAddress.toLowerCase() ||
              (tx.from.toLowerCase() === iDAIAddress.toLowerCase() && tx.to.toLowerCase() === this.props.account.toLowerCase())
      ).filter(tx => {
        const internalTxs = results.filter(r => r.hash === tx.hash);
        // remove txs from old contract
        return !internalTxs.filter(iTx => iTx.contractAddress.toLowerCase() === OldIdleAddress.toLowerCase()).length;
      }).map(tx => ({...tx, value: this.toEth(tx.value)}));

    let amountLent = 0;
    let transactions = {};
    prevTxs.forEach((tx,index) => {
      // Deposited
      if (tx.to.toLowerCase() === IdleAddress.toLowerCase()){
        amountLent += parseFloat(tx.value);
      } else if (tx.to.toLowerCase() === this.props.account.toLowerCase()){
        amountLent -= parseFloat(tx.value);
        amountLent = Math.max(0,amountLent);
      }
      transactions[tx.hash] = tx;
    });
    if (executedTxs){
      Object.keys(executedTxs).forEach((key,index) => {
        const tx = executedTxs[key];
        transactions[tx.hash] = tx;
      });
    }

    // console.log('prevTxs',prevTxs);

    let earning = this.state.earning;
    if (this.state.tokenToRedeem){
      earning = this.state.tokenToRedeem.minus(this.BNify(amountLent));
    }

    amountLent = Math.max(0,amountLent);

    this.setState({
      prevTxs: transactions,
      amountLent,
      earning
    });
  };

  // Check for updates to the transactions collection
  processTransactionUpdates = prevProps => {
    let txs = this.state.prevTxs || {};
    let newTxs = {};
    let updated = false;
    let refresh = false;
    if (Object.keys(this.props.transactions).length){
      Object.keys(this.props.transactions).forEach(key => {
        let pendingTx = this.props.transactions[key];
        if ((!txs[key] || txs[key].status !== pendingTx.status)){

          // Delete transaction is succeded or error
          if (pendingTx.status === 'success' || pendingTx.status === 'error') {
            if (txs[key]){
              updated = true;
              delete txs[key];
            }

            if (pendingTx.status === 'success'){
              refresh = true;
              if (this.state.needsUpdate) {
                this.getBalanceOf('IdleDAI'); // do not wait
                this.props.getAccountBalance(); // do not wait
              }
            }
          } else {
            let tx = {
              from: '',
              to: '',
              status: 'Pending',
              hash: key,
              value: 0,
              tokenName: '',
              tokenSymbol: '',
              timeStamp: parseInt(pendingTx.lastUpdated/1000)
            };

            if (pendingTx.transactionHash) {
              tx.hash = pendingTx.transactionHash.toString();
            }

            if (!txs[key]){
              newTxs[key] = tx;
            }

            txs[key] = tx;

            updated = true;
          }
        }
      });

      if (refresh){
        this.getPrevTxs(newTxs);
      } else if (updated){
        this.setState({
          prevTxs: txs
        });
      }
    }
  };

  async componentWillUnmount(){
    if (this.state.earningIntervalId){
      window.clearInterval(this.state.earningIntervalId);
    }
  }

  async componentDidMount() {
    console.log('Smart contract didMount')
    // do not wait for each one just for the first who will guarantee web3 initialization
    const web3 = await this.props.initWeb3();
    if (!web3) {
      return console.log('No Web3 SmartContractControls')
    }

    console.log('Web3 SmartContractControls initialized')
    this.props.initContract('iDAI', iDAIAddress, iDAIAbi, true);
    this.props.initContract('cDAI', cDAIAddress, cDAIAbi);
    this.props.initContract('OldIdleDAI', OldIdleAddress, IdleAbi);
    this.props.initContract('IdleDAI', IdleAddress, IdleAbi).then(async () => {
      // await this.getAprs();
      await Promise.all([
        this.getAprs(),
        this.getPriceInToken('IdleDAI')
      ]);
    });

    this.props.initContract('DAI', DAIAddress, DAIAbi);
  }

  async componentDidUpdate(prevProps, prevState) {
    if (this.props.account && (prevProps.account !== this.props.account || this.state.needsUpdate)) {

      await Promise.all([
        this.getPrevTxs(),
        this.getBalanceOf('IdleDAI'),
        this.getOldBalanceOf('OldIdleDAI'),
        this.getTotalSupply('IdleDAI')
      ]);

      if (this.props.selectedTab === '3') {
        await this.rebalanceCheck();
      }

      // check if Idle is approved for DAI
      if (this.props.account && !this.state[`isApprovingDAI`]) {
        const value = this.props.web3.utils.toWei('0',"ether");
        const allowance = await this.getAllowance('DAI'); // DAI
        if (this.BNify(allowance).lt(this.BNify(value.toString()))) {
          return this.setState({
            approveIsOpen: true,
            needsUpdate: false
          });
        }
      }

      // Check if first time entered
      let welcomeIsOpen = prevProps.account !== this.props.account;
      if (localStorage){
        welcomeIsOpen = welcomeIsOpen && !localStorage.getItem('firstLogin');
        localStorage.setItem('firstLogin',new Date().getTime().toString());
      } else {
        welcomeIsOpen = false;
      }

      this.setState({
        // welcomeIsOpen: welcomeIsOpen,
        needsUpdate: false
      });
    }

    if (this.props.selectedTab !== '2' && this.state.fundsTimeoutID){
      console.log("Clear funds timeout "+this.state.fundsTimeoutID);
      clearTimeout(this.state.fundsTimeoutID);
      this.setState({fundsTimeoutID:null});
    }

    if (prevProps.transactions !== this.props.transactions){
      this.processTransactionUpdates(prevProps);
    }
  }

  async selectTab(e, tabIndex) {
    e.preventDefault();
    this.props.updateSelectedTab(e,tabIndex);

    if (tabIndex === '3') {
      await this.rebalanceCheck();
    }

    if (tabIndex !== '2') {
      if (this.state.earningIntervalId){
        window.clearInterval(this.state.earningIntervalId);
      }
    } else {
      
    }

  }

  // TODO move in a separate component
  renderPrevTxs() {
    const prevTxs = this.state.prevTxs || {};

    if (!Object.keys(prevTxs).length) {
      return null;
    }

    const txs = Object.keys(prevTxs).reverse().map((key, i) => {
      const tx = prevTxs[key];
      const date = new Date(tx.timeStamp*1000);
      const status = tx.status ? tx.status : tx.to.toLowerCase() === IdleAddress.toLowerCase() ? 'Deposited' : 'Redeemed';
      const value = parseFloat(tx.value) ? (this.props.isMobile ? parseFloat(tx.value).toFixed(4) : parseFloat(tx.value).toFixed(8)) : '-';
      const formattedDate = moment(date).fromNow();
      let color;
      let icon;
      switch (status) {
        case 'Deposited':
          color = 'blue';
          icon = "ArrowDownward";
        break;
        case 'Redeemed':
          color = 'green';
          icon = "ArrowUpward";
        break;
        default:
          color = 'grey';
          icon = "Refresh";
        break;
      }
      return (
        <Link key={'tx_'+i} display={'block'} href={`https://etherscan.io/tx/${tx.hash}`} target={'_blank'}>
          <Flex alignItems={'center'} flexDirection={['row','row']} width={'100%'} p={[2,3]} borderBottom={'1px solid #D6D6D6'}>
            <Box width={[1/10]} textAlign={'right'}>
                <Icon name={icon} color={color} style={{float:'left'}}></Icon>
            </Box>
            <Box width={[2/10,2/10]} display={['none','block']} textAlign={'center'}>
              <Pill color={color}>
                {status}
              </Pill>
            </Box>
            <Box width={[4/10]}>
              <Text textAlign={'center'} fontSize={[2,2]} fontWeight={2}>{value} {tx.tokenSymbol}</Text>
            </Box>
            <Box width={[4/10,3/10]} textAlign={'center'}>
              <Text textAlign={'center'} fontSize={[2,2]} fontWeight={2}>{formattedDate}</Text>
            </Box>
          </Flex>
        </Link>
      )});

    return (
      <Flex flexDirection={'column'} width={[1,'90%']} m={'0 auto'}>
        <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} mb={[2,2]} color={'dark-gray'}>
          Last transactions
        </Heading.h3>
        {txs}
      </Flex>
    );
  }

  getFormattedBalance(balance,label,decimals,maxLen,highlightedDecimals){
    const defaultValue = '-';
    decimals = !isNaN(decimals) ? decimals : 6;
    maxLen = !isNaN(maxLen) ? maxLen : 10;
    highlightedDecimals = !isNaN(highlightedDecimals) ? highlightedDecimals : 0;
    balance = this.BNify(balance).toFixed(decimals);

    const numLen = balance.toString().replace('.','').length;
    if (numLen>maxLen){
      decimals = Math.max(0,decimals-(numLen-maxLen));
      balance = this.BNify(balance).toFixed(decimals);
    }

    const intPart = Math.floor(balance);
    let decPart = (balance%1).toString().substr(2,decimals);
    decPart = (decPart+("0".repeat(decimals))).substr(0,decimals);

    if (highlightedDecimals){
      const highlightedDec = decPart.substr(0,highlightedDecimals);
      decPart = decPart.substr(highlightedDecimals);
      const highlightedIntPart = (<Text.span fontSize={'100%'} color={'blue'} fontWeight={'inerith'}>{intPart}.{highlightedDec}</Text.span>);
      return !isNaN(this.trimEth(balance)) ? ( <>{highlightedIntPart}<small style={{fontSize:'70%'}}>{decPart}</small> <Text.span fontSize={[1,2]}>{label}</Text.span></> ) : defaultValue;
    } else {
      return !isNaN(this.trimEth(balance)) ? ( <>{intPart}<small>.{decPart}</small> <Text.span fontSize={[1,2]}>{label}</Text.span></> ) : defaultValue;
    }
  }

  formatCountUp(number,decimals){
    decimals = decimals ? decimals : 9;
    const intPart = Math.floor(number);
    let decPart = (number%1).toString().substr(2,decimals);
    decPart = (decPart+("0".repeat(decimals))).substr(0,decimals);

    return intPart+".<small>"+decPart+"</small> <span style='font-size:16px;font-weight:400;line-height:1.5;color:#3F3D4B'>DAI</span>";
  }

  render() {
    const hasBalance = !isNaN(this.trimEth(this.state.DAIToRedeem)) && this.trimEth(this.state.DAIToRedeem) > 0;
    const navPool = this.getFormattedBalance(this.state.navPool,'DAI');
    const reedemableFunds = this.getFormattedBalance(this.state.DAIToRedeem,'DAI',9,12);
    const oldReedemableFunds = this.getFormattedBalance(this.state.oldDAIToRedeem,'DAI');
    const currentEarnings = this.getFormattedBalance(this.state.earning,'DAI',9,12);
    const oldEarning = this.getFormattedBalance(this.state.oldEarning,'DAI');
    const IdleDAIPrice = this.getFormattedBalance(this.state.IdleDAIPrice,'DAI');
    const OldIdleDAIPrice = this.getFormattedBalance(this.state.OldIdleDAIPrice,'DAI');
    const depositedFunds = this.getFormattedBalance(this.state.amountLent,'DAI');
    const earningPerc = !isNaN(this.trimEth(this.state.DAIToRedeem)) && this.trimEth(this.state.DAIToRedeem)>0 ? this.getFormattedBalance(this.BNify(this.state.DAIToRedeem).div(this.BNify(this.state.amountLent)).minus(1).times(100),'%',4) : '0%';
    const balanceOfIdleDAI = this.getFormattedBalance(this.state.balanceOfIdleDAI,'idleDAI');
    const balanceOfOldIdleDAI = this.getFormattedBalance(this.state.balanceOfOldIdleDAI,'idleDAI');
    const hasOldBalance = !isNaN(this.trimEth(this.state.oldDAIToRedeem)) && this.trimEth(this.state.oldDAIToRedeem) > 0;

    const earningPerDay = this.getFormattedBalance((this.state.earningPerYear/365),'DAI',4);
    const earningPerWeek = this.getFormattedBalance((this.state.earningPerYear/365*7),'DAI',4);
    const earningPerMonth = this.getFormattedBalance((this.state.earningPerYear/12),'DAI',4);
    const earningPerYear = this.getFormattedBalance((this.state.earningPerYear),'DAI',4);

    const currentNavPool = !isNaN(this.trimEth(this.state.navPool)) ? parseFloat(this.trimEth(this.state.navPool,9)) : null;
    const navPoolEarningPerYear = currentNavPool ? parseFloat(this.trimEth(this.BNify(this.state.navPool).times(this.BNify(this.state.maxRate/100)),9)) : null;
    const navPoolAtEndOfYear = currentNavPool ? parseFloat(this.trimEth(this.BNify(this.state.navPool).plus(this.BNify(navPoolEarningPerYear)),9)) : null;

    const currentReedemableFunds = !isNaN(this.trimEth(this.state.DAIToRedeem)) && !isNaN(this.trimEth(this.state.earningPerYear)) ? parseFloat(this.trimEth(this.state.DAIToRedeem,9)) : 0;
    const reedemableFundsAtEndOfYear = !isNaN(this.trimEth(this.state.DAIToRedeem)) && !isNaN(this.trimEth(this.state.earningPerYear)) ? parseFloat(this.trimEth(this.BNify(this.state.DAIToRedeem).plus(this.BNify(this.state.earningPerYear)),9)) : 0;
    const currentEarning = !isNaN(this.trimEth(this.state.earning)) ? parseFloat(this.trimEth(this.state.earning,9)) : 0;
    const earningAtEndOfYear = !isNaN(this.trimEth(this.state.earning)) ? parseFloat(this.trimEth(this.BNify(this.state.earning).plus(this.BNify(this.state.earningPerYear)),9)) : 0;

    const fundsAreReady = !isNaN(this.trimEth(this.state.DAIToRedeem)) && !isNaN(this.trimEth(this.state.earning)) && !isNaN(this.trimEth(this.state.amountLent)) && !isNaN(this.trimEth(this.state.earning));

    return (
      <Box textAlign={'center'} alignItems={'center'} width={'100%'}>
        <Form pb={[0, 2]} minHeight={['auto','20em']} backgroundColor={'white'} color={'blue'} boxShadow={'0 0 25px 5px rgba(102, 139, 255, 0.7)'} borderRadius={'15px'}>
          <Flex justifyContent={'center'}>
            <Flex flexDirection={['row','row']} width={['100%','80%']} pt={[2,3]}>
              <Box className={[styles.tab,this.props.selectedTab==='1' ? styles.tabSelected : '']} width={[1/3]} textAlign={'center'}>
                <Link display={'block'} pt={[2,3]} pb={2} fontSize={[2,3]} fontWeight={2} onClick={e => this.selectTab(e, '1')}>
                  Lend
                </Link>
              </Box>
              <Box className={[styles.tab,this.props.selectedTab==='2' ? styles.tabSelected : '']} width={[1/3]} textAlign={'center'} borderLeft={'1px solid #fff'} borderRight={'1px solid #fff'}>
                <Link display={'block'} pt={[2,3]} pb={2} fontSize={[2,3]} fontWeight={2} onClick={e => this.selectTab(e, '2')}>
                  Funds
                </Link>
              </Box>
              <Box className={[styles.tab,this.props.selectedTab==='3' ? styles.tabSelected : '']} width={[1/3]} textAlign={'center'} borderRight={'none'}>
                <Link display={'block'} pt={[2,3]} pb={2} fontSize={[2,3]} fontWeight={2} onClick={e => this.selectTab(e, '3')}>
                  Rebalance
                </Link>
              </Box>
            </Flex>
          </Flex>

          <Box boxShadow={'inset 0px 7px 4px -4px rgba(0,0,0,0.1)'} py={[2, 3]}>
            {this.props.selectedTab === '1' &&
              <Box textAlign={'text'} py={3}>
                {
                  false &&
                  <Button
                    className={styles.gradientButton}
                    onClick={e => this.disableERC20(e, this.state.tokenName)}
                    size={this.props.isMobile ? 'medium' : 'medium'}
                    borderRadius={4}
                    mainColor={'blue'}
                    contrastColor={'white'}
                    fontWeight={3}
                    fontSize={[2,2]}
                    mx={'auto'}
                    px={[4,5]}
                    mt={[3,4]}
                  >
                    DISABLE DAI
                  </Button>
                }

                <Heading.h3 pb={[2, 0]} mb={[2,3]} fontFamily={'sansSerif'} fontSize={[2, 3]} fontWeight={2} color={'dark-gray'} textAlign={'center'}>
                  Earn <Text.span fontWeight={'bold'} fontSize={[3,4]}>{this.state.maxRate}% APR</Text.span> on your DAI
                </Heading.h3>

                {hasOldBalance ?
                  <Flash variant="warning" width={1}>
                    We have released a new version of the contract, with a small bug fix, please redeem
                    your assets in the old contract, by heading to 'Funds' tab and clicking on `Redeem DAI`
                    Once you have done that you will be able to mint and redeem with the new contract.
                    Sorry for the inconvenience.
                  </Flash> : 
                  (
                    <>
                      { !this.state.isApprovingDAI && !this.state.lendingProcessing &&
                        <CryptoInput
                          genericError={this.state.genericError}
                          disableLendButton={this.state.disableLendButton}
                          isMobile={this.props.isMobile}
                          account={this.props.account}
                          accountBalanceDAI={this.props.accountBalanceDAI}
                          defaultValue={this.state.lendAmount}
                          IdleDAIPrice={hasOldBalance ? this.state.OldIdleDAIPrice : this.state.IdleDAIPrice}
                          BNify={this.BNify}
                          trimEth={this.trimEth}
                          color={'black'}
                          selectedAsset='DAI'
                          useEntireBalance={this.useEntireBalance}
                          handleChangeAmount={this.handleChangeAmount}
                          handleClick={e => this.mint(e)} />
                      }

                      { this.state.lendingProcessing &&
                        <Flex
                          justifyContent={'center'}
                          alignItems={'center'}
                          textAlign={'center'}>
                          <Loader size="40px" /> <Text ml={2}>Processing lend request...</Text>
                        </Flex>
                      }
                    </>
                  )
                }

                {this.state.isApprovingDAI && (
                  <Flex
                    justifyContent={'center'}
                    alignItems={'center'}
                    textAlign={'center'}>
                    <Loader size="40px" /> <Text ml={2}>Wait for the approve transaction to be mined</Text>
                  </Flex>
                )}

                <Flex justifyContent={'center'} mt={[0,3]}>
                  <Heading.h5 mt={2} color={'darkGray'} fontWeight={1} fontSize={1} textAlign={'center'}>
                    *This is beta software. Use at your own risk.
                  </Heading.h5>
                </Flex>

              </Box>
            }

            {this.props.selectedTab === '2' &&
              <Box px={[2,0]} py={[3,0]} textAlign={'text'}>
                {this.props.account &&
                  <>
                    {
                      fundsAreReady ? (
                        <>
                          <Box>
                            {!!hasOldBalance &&
                              <Flash variant="warning" width={1}>
                                We have released a new version of the contract, with a small bug fix, please redeem
                                your assets in the old contract, by heading to 'Funds' tab and clicking on `Redeem DAI`
                                Once you have done that you will be able to mint and redeem with the new contract.
                                Sorry for the inconvenience.
                              </Flash>
                            }
                            <Flex flexDirection={['column','row']} py={[2,3]} width={[1,'70%']} m={'0 auto'}>
                              <Box width={[1,1/2]}>
                                <Heading.h3 fontWeight={2} textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} mb={[2,2]} color={'blue'}>
                                  Redeemable Funds
                                </Heading.h3>
                                <Heading.h3 fontFamily={'sansSerif'} fontSize={[4,5]} mb={[2,0]} fontWeight={2} color={'black'} textAlign={'center'}>
                                  {
                                    hasBalance && this.state.amountLent ? (
                                      <CountUp
                                        start={currentReedemableFunds}
                                        end={reedemableFundsAtEndOfYear}
                                        duration={315569260}
                                        delay={0}
                                        separator=" "
                                        decimals={9}
                                        decimal="."
                                        formattingFn={(n)=>{ return this.formatCountUp(n); }}
                                      >
                                        {({ countUpRef, start }) => (
                                          <span ref={countUpRef} />
                                        )}
                                      </CountUp>
                                    ) : reedemableFunds
                                  }
                                </Heading.h3>
                              </Box>
                              <Box width={[1,1/2]}>
                                <Heading.h3 fontWeight={2} textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} mb={[2,2]} color={'blue'}>
                                  Current earnings
                                </Heading.h3>
                                <Heading.h3 fontFamily={'sansSerif'} fontSize={[4,5]} fontWeight={2} color={'black'} textAlign={'center'}>
                                  {
                                    hasBalance && this.state.amountLent ? (
                                      <CountUp
                                        start={currentEarning}
                                        end={earningAtEndOfYear}
                                        duration={315569260}
                                        delay={0}
                                        separator=" "
                                        decimals={9}
                                        decimal="."
                                        formattingFn={(n)=>{ return this.formatCountUp(n); }}
                                      >
                                        {({ countUpRef, start }) => (
                                          <span ref={countUpRef} />
                                        )}
                                      </CountUp>
                                    ) : currentEarnings
                                  }
                                </Heading.h3>
                              </Box>
                            </Flex>
                        </Box>
                        <Box pb={[3,4]} borderBottom={'1px solid #D6D6D6'}>
                          {hasBalance && !hasOldBalance && !this.state.redeemProcessing &&
                            <Flex
                              textAlign='center'
                              flexDirection={'column'}
                              alignItems={'center'}>
                              {
                                this.state.partialRedeemEnabled &&
                                  <CryptoInput
                                    genericError={this.state.genericError}
                                    icon={'images/idle-dai.png'}
                                    buttonLabel={'REDEEM idleDAI'}
                                    placeholder={'Enter idleDAI amount'}
                                    disableLendButton={this.state.disableRedeemButton}
                                    isMobile={this.props.isMobile}
                                    account={this.props.account}
                                    accountBalanceDAI={this.state.balanceOfIdleDAI}
                                    defaultValue={this.state.redeemAmount}
                                    IdleDAIPrice={hasOldBalance ? (1/this.state.OldIdleDAIPrice) : (1/this.state.IdleDAIPrice)}
                                    convertedLabel={'DAI'}
                                    balanceLabel={'idleDAI'}
                                    BNify={this.BNify}
                                    trimEth={this.trimEth}
                                    color={'black'}
                                    selectedAsset='DAI'
                                    useEntireBalance={this.useEntireBalanceRedeem}
                                    handleChangeAmount={this.handleChangeAmountRedeem}
                                    handleClick={e => this.redeem(e, 'IdleDAI')} />
                              }

                              {
                                !this.state.partialRedeemEnabled &&
                                  <Button
                                    className={styles.gradientButton}
                                    onClick={e => this.redeem(e, 'IdleDAI')}
                                    borderRadius={4}
                                    size={this.props.isMobile ? 'medium' : 'medium'}
                                    mainColor={'blue'}
                                    contrastColor={'white'}
                                    fontWeight={3}
                                    fontSize={[2,2]}
                                    mx={'auto'}
                                    px={[4,5]}
                                    mt={2}
                                  >
                                    REDEEM ALL
                                  </Button>
                              }
                              <Link color={'darkGray'} hoverColor={'blue'} fontWeight={1} fontSize={1} mt={[1,2]} onClick={ e => { this.togglePartialRedeem() } }>
                                Redeem {!this.state.partialRedeemEnabled ? 'partial' : 'entire'} amount
                              </Link>
                            </Flex>
                          }
                          {hasOldBalance && !this.state.redeemProcessing &&
                            <Flex
                              textAlign='center'>
                              <Button
                                className={styles.gradientButton}
                                onClick={e => this.redeem(e, 'OldIdleDAI')}
                                borderRadius={4}
                                size={this.props.isMobile ? 'medium' : 'medium'}
                                mainColor={'blue'}
                                contrastColor={'white'}
                                fontWeight={3}
                                fontSize={[2,2]}
                                mx={'auto'}
                                px={[4,5]}
                                mt={2}
                              >
                                REDEEM DAI (old contract)
                              </Button>
                            </Flex>
                          }
                          {!hasBalance && !hasOldBalance &&
                            <Flex
                              textAlign='center'>
                              <Button
                                className={styles.gradientButton}
                                onClick={e => this.selectTab(e, '1')}
                                borderRadius={4}
                                size={this.props.isMobile ? 'medium' : 'medium'}
                                mainColor={'blue'}
                                contrastColor={'white'}
                                fontWeight={3}
                                fontSize={[2,2]}
                                mx={'auto'}
                                px={[4,5]}
                                mt={2}
                              >
                                LEND NOW
                              </Button>
                            </Flex>
                          }
                          {this.state.redeemProcessing &&
                            <Flex
                              justifyContent={'center'}
                              alignItems={'center'}
                              textAlign={'center'}>
                              <Loader size="40px" /> <Text ml={2}>Processing redeem request...</Text>
                            </Flex>
                          }
                        </Box>
                        { hasBalance &&
                          <Flex flexDirection={'column'} pt={[3,4]} pb={[0,3]} alignItems={'center'}>
                            <Button
                              onClick={e => this.toggleShowFundsInfo(e) }
                              textAlign={'center'}
                              color={'darkGray'}
                              hoverColor={'dark-gray'}
                              fontSize={2}
                              fontWeight={3}
                              borderRadius={4}
                              mainColor={'darkGray'}
                              size={'small'}
                              contrastColor={'white'}
                            >
                              <Flex flexDirection={'column'} pb={0} alignItems={'center'}>
                                {
                                  false && this.state.showFundsInfo && 
                                  <Box>
                                    <Icon
                                      className={styles.bounceArrow}
                                      align={'center'}
                                      name={'KeyboardArrowUp'}
                                      color={'darkGray'}
                                      size={"2em"}
                                    />
                                  </Box>
                                }
                                <Box>
                                  { this.state.showFundsInfo ? 'Show less info' : 'Show more info' }
                                </Box>
                                {
                                  false && !this.state.showFundsInfo && 
                                  <Box>
                                    <Icon
                                      className={styles.bounceArrow}
                                      align={'center'}
                                      name={'KeyboardArrowDown'}
                                      color={'darkGray'}
                                      size={"2em"}
                                    />
                                  </Box>
                                }
                              </Flex>
                            </Button>
                          </Flex>
                        }
                      </>
                      ) : (
                        <Flex
                          py={[2,3]}
                          justifyContent={'center'}
                          alignItems={'center'}
                          textAlign={'center'}>
                          <Loader size="40px" /> <Text ml={2}>Processing funds...</Text>
                        </Flex>
                      )
                    }
                    {
                      hasBalance && this.state.showFundsInfo ?
                        !isNaN(this.trimEth(this.state.earningPerYear)) ? (
                        <>
                          <Box my={[3,4]} pb={3,4} borderBottom={'1px solid #D6D6D6'}>
                            <Flex flexDirection={'column'} width={[1,'90%']} m={'0 auto'}>
                              <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} mb={[2,2]} color={'dark-gray'}>
                                Funds overview
                              </Heading.h3>
                              <Flex flexDirection={['column','row']} width={'100%'}>
                                <Flex flexDirection={'row'} py={[2,3]} width={[1,'1/2']} m={'0 auto'}>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Deposited funds
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      { depositedFunds }
                                    </Heading.h3>
                                  </Box>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Earning
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      { earningPerc }
                                    </Heading.h3>
                                  </Box>
                                </Flex>
                                <Flex flexDirection={'row'} py={[2,3]} width={[1,'1/2']} m={'0 auto'}>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Current holdings
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      { hasOldBalance ? balanceOfOldIdleDAI : balanceOfIdleDAI }
                                    </Heading.h3>
                                  </Box>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      idleDAI price
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      { hasOldBalance ? OldIdleDAIPrice : IdleDAIPrice }
                                    </Heading.h3>
                                  </Box>
                                </Flex>
                              </Flex>
                            </Flex>
                          </Box>
                          <Box my={[3,4]} pb={3,4} borderBottom={'1px solid #D6D6D6'}>
                            <Flex flexDirection={'column'} width={[1,'90%']} m={'0 auto'}>
                              <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} mb={[2,2]} color={'dark-gray'}>
                                Estimated earnings
                              </Heading.h3>
                              <Flex flexDirection={['column','row']} width={'100%'}>
                                <Flex flexDirection={'row'} py={[2,3]} width={[1,'1/2']} m={'0 auto'}>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Daily
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      {earningPerDay}
                                    </Heading.h3>
                                  </Box>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Weekly
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      {earningPerWeek}
                                    </Heading.h3>
                                  </Box>
                                </Flex>
                                <Flex flexDirection={'row'} py={[2,3]} width={[1,'1/2']} m={'0 auto'}>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Monthly
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      {earningPerMonth}
                                    </Heading.h3>
                                  </Box>
                                  <Box width={1/2}>
                                    <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      Yearly
                                    </Text>
                                    <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                                      {earningPerYear}
                                    </Heading.h3>
                                  </Box>
                                </Flex>
                              </Flex>
                            </Flex>
                          </Box>
                        </>
                        ) : (
                          <Flex
                            py={[2,3]}
                            justifyContent={'center'}
                            alignItems={'center'}
                            textAlign={'center'}>
                            <Loader size="40px" /> <Text ml={2}>Processing funds info...</Text>
                          </Flex>
                        )
                      : ''
                    }
                    <Box my={[3,4]} pb={3,4}>
                      {
                        this.state.prevTxs ? (
                          this.renderPrevTxs()
                        ) : (
                          <Flex
                            justifyContent={'center'}
                            alignItems={'center'}
                            textAlign={'center'}>
                            <Loader size="40px" /> <Text ml={2}>Processing transactions...</Text>
                          </Flex>
                        )
                      }
                    </Box>
                  </>
                }

                {!this.props.account &&
                  <Flex
                    alignItems={'center'}
                    flexDirection={'column'}
                    textAlign={'center'}
                    py={[1,3]}>
                      <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontWeight={2} fontSize={[3,3]} color={'dark-gray'}>
                        Please connect to view your available funds.
                      </Heading.h3>
                      <Button
                        className={styles.gradientButton}
                        onClick={e => this.redeem(e, 'IdleDAI')}
                        size={this.props.isMobile ? 'medium' : 'medium'}
                        borderRadius={4}
                        mainColor={'blue'}
                        contrastColor={'white'}
                        fontWeight={3}
                        fontSize={[2,2]}
                        mx={'auto'}
                        px={[4,5]}
                        mt={[3,4]}
                      >
                        CONNECT
                      </Button>
                  </Flex>
                }
              </Box>
            }

            { this.props.selectedTab === '3' && 
              <>
                <Box width={'100%'} borderBottom={'1px solid #D6D6D6'} mb={2}>
                  <Flex flexDirection={['column','row']} py={[2,3]} width={[1,'50%']} m={'0 auto'}>
                    <Box width={[1,1/2]}>
                      <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'blue'} textAlign={'center'}>
                        Allocated funds
                      </Text>
                      <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                        {navPool ? 
                          <CountUp
                            start={currentNavPool}
                            end={navPoolAtEndOfYear}
                            duration={315569260}
                            delay={0}
                            separator=" "
                            decimals={6}
                            decimal="."
                            formattingFn={(n)=>{ return this.formatCountUp(n,6); }}
                          >
                            {({ countUpRef, start }) => (
                              <span ref={countUpRef} />
                            )}
                          </CountUp>
                          : '-'
                        }
                      </Heading.h3>
                    </Box>
                    <Box width={[1,1/2]}>
                      <Text fontFamily={'sansSerif'} fontSize={[1, 2]} fontWeight={2} color={'blue'} textAlign={'center'}>
                        Current protocol
                      </Text>
                      <Heading.h3 fontFamily={'sansSerif'} fontSize={[3,4]} fontWeight={2} color={'black'} textAlign={'center'}>
                        { this.state.currentProtocol ? this.state.currentProtocol : '-' }
                      </Heading.h3>
                    </Box>
                  </Flex>
                </Box>
                { !!this.state.calculataingShouldRebalance && 
                  <Box px={[2,0]} textAlign={'text'} py={[3,0]}>
                    <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} py={3} color={'blue'}>
                      Rebalance the entire pool. All users will bless you.
                    </Heading.h3>
                    <Flex
                      justifyContent={'center'}
                      alignItems={'center'}
                      textAlign={'center'}
                      pt={3}>
                          <Loader size="40px" /> <Text ml={2}>Checking rebalance status...</Text>
                    </Flex>
                  </Box>
                }
              </>
            }

            { this.props.selectedTab === '3' && !this.state.calculataingShouldRebalance && !!this.state.shouldRebalance && 
              <Box px={[2,0]}py={[3,0]}>
                {!!hasOldBalance &&
                  <Flash variant="warning" width={1}>
                    We have released a new version of the contract, with a small bug fix, please redeem
                    your assets in the old contract, by heading to 'Funds' tab and clicking on `Redeem DAI`
                    Once you have done that you will be able to mint and redeem with the new contract.
                    Sorry for the inconvenience.
                  </Flash>
                }
                {this.state.rebalanceProcessing ? (
                    <>
                      <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} py={3} color={'blue'}>
                        Thanks for rebalancing!
                      </Heading.h3>
                      <Loader size="40px" /> <Text ml={2}>Processing rebalance request...</Text>
                    </>
                  ) : (
                    <>
                      <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} py={3} color={'blue'}>
                        Rebalance the entire pool. All users will bless you.
                      </Heading.h3>
                      <Heading.h4 color={'dark-gray'} fontSize={[2,2]} px={[3,0]} textAlign={'center'} fontWeight={2} lineHeight={1.5}>
                        The whole pool is automatically rebalanced each time a user interacts with Idle.<br />
                        But you can also trigger a rebalance anytime and this will benefit all users (included you).
                      </Heading.h4>
                      <Flex
                        justifyContent={'center'}
                        alignItems={'center'}
                        textAlign={'center'}
                        pt={2}>
                        <Button
                          className={styles.gradientButton}
                          onClick={this.rebalance}
                          size={this.props.isMobile ? 'medium' : 'medium'}
                          borderRadius={4}
                          contrastColor={'white'}
                          fontWeight={3}
                          fontSize={[2,2]}
                          mx={'auto'}
                          px={[4,5]}
                          mt={[2,3]}
                        >
                          REBALANCE NOW
                        </Button>
                      </Flex>
                    </>
                  )
                }
              </Box>
            }

            {
              this.props.selectedTab === '3' && !this.state.calculataingShouldRebalance && !this.state.shouldRebalance &&
              <Box px={[2,0]} textAlign={'center'} py={[3,0]}>
                <Heading.h3 textAlign={'center'} fontFamily={'sansSerif'} fontSize={[3,3]} py={3} color={'blue'}>
                  The pool is already balanced.
                </Heading.h3>
                <Heading.h4 color={'dark-gray'} fontSize={[2,2]} px={[3,0]} textAlign={'center'} fontWeight={2} lineHeight={1.5}>
                  The current interest rate is already the best between the integrated protocols.<br />Sit back and enjoy your earnings.
                </Heading.h4>
              </Box>
            }

            </Box>
        </Form>

        <WelcomeModal
          account={this.props.account}
          isOpen={this.state.welcomeIsOpen}
          closeModal={this.toggleWelcomeModal}
          tokenName={this.state.tokenName}
          baseTokenName={this.state.baseTokenName}
          network={this.props.network.current} />

        <ApproveModal
          account={this.props.account}
          isOpen={this.state.approveIsOpen}
          closeModal={this.toggleModal}
          onClick={e => this.enableERC20(e, this.state.tokenName)}
          tokenName={this.state.tokenName}
          baseTokenName={this.state.baseTokenName}
          network={this.props.network.current} />

        <MaxCapModal
          account={this.props.account}
          isOpen={this.state.capReached}
          maxCap={this.BNify(this.state.idleDAICap)}
          currSupply={this.BNify(this.state.IdleDAISupply)}
          closeModal={this.toggleMaxCapModal}
          network={this.props.network.current} />
      </Box>
    );
  }
}

export default SmartContractControls;
