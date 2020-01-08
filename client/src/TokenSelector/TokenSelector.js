import React, { Component } from "react";
import { Flex } from 'rimble-ui';
import styles from './TokenSelector.module.scss';
import TokenSelectorItem from './TokenSelectorItem.js';

class TokenSelector extends Component {
  state = {
    opened: false
  };

  toggleOpen(){
    this.setState({
      opened:!this.state.opened
    })
  }

  handleSelector(opened){
    this.setState({
      opened
    });
  }


  selectToken(token,tokenInfo){
    if (tokenInfo.enabled){
      this.toggleOpen();
      this.props.setSelectedToken(token);
      return true;
    }
    return false;
  }

  render() {

    const tokens = Object.keys(this.props.availableTokens).map((token,i) => {
                      if (token !== this.props.selectedToken){
                        const tokenInfo = this.props.availableTokens[token];
                        const tokenEnabled = tokenInfo.enabled;
                        if (!this.props.isMobile || tokenEnabled){
                          return (
                            <TokenSelectorItem isMobile={this.props.isMobile} disabled={!tokenEnabled} key={'token_selector_'+token} borderRadius={4} isChild={true} token={token} handleClick={ e => {this.selectToken(token,tokenInfo) }} />
                          );
                        }
                      }
                      return null;
                    });

    return (
        <Flex
          position={'relative'}
          flexDirection={'column'}
          width={['100%','auto']}
          alignItems={'center'}
          justifyContent={'flex-end'}
          onClick={ this.props.isMobile ? e => { this.toggleOpen() } : null }
          onMouseEnter={ this.props.isMobile ? null : e => {this.handleSelector(true)} }
          onMouseLeave={ this.props.isMobile ? null : e => {this.handleSelector(false)} }
          borderRadius={this.props.borderRadius}
          borderLeft={this.props.borderLeft}
          borderRight={this.props.borderRight}
          >
            <TokenSelectorItem isMobile={this.props.isMobile} borderRadius={this.props.borderRadius} disabled={false} token={this.props.selectedToken} />
            <Flex flexDirection={'column'} borderRadius={4} backgroundColor={ this.props.isMobile ? 'transparent' : 'white' } overflow={'hidden'} className={[styles.selectorCurtain,this.state.opened ? styles.opened : null]} position={['static','absolute']} top={'100%'}>
              { tokens }
            </Flex>
        </Flex>
    );
  }
}
export default TokenSelector;
