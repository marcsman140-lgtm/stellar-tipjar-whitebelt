import React, { useState, useEffect } from 'react';
import { isConnected, requestAccess, getPublicKey, signTransaction } from '@stellar/freighter-api';
import * as StellarSdk from '@stellar/stellar-sdk';
import confetti from 'canvas-confetti';
import { Wallet, Send, RefreshCw, ExternalLink, ShieldCheck, PowerOff, Droplets } from 'lucide-react';
import './App.css';

const App = () => {
  const [walletAddress, setWalletAddress] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fundLoading, setFundLoading] = useState(false);
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [txHash, setTxHash] = useState(null);

  const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');

  const checkConnection = async () => {
    if (await isConnected()) {
      const pubKey = await getPublicKey();
      if (pubKey) {
        setWalletAddress(pubKey);
        fetchBalance(pubKey);
      }
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const connectWallet = async () => {
    try {
      if (await isConnected()) {
        const access = await requestAccess();
        setWalletAddress(access);
        fetchBalance(access);
      } else {
        alert('Please install Freighter wallet extension.');
      }
    } catch (error) {
      console.error('Connection error:', error);
    }
  };

  const disconnectWallet = () => {
    setWalletAddress(null);
    setBalance(null);
    setTxHash(null);
  };

  const fetchBalance = async (address) => {
    setLoading(true);
    try {
      const account = await server.loadAccount(address);
      const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
      if (xlmBalance) {
        setBalance(xlmBalance.balance);
      }
    } catch (error) {
      setBalance('0.00'); // Unfunded account
    } finally {
      setLoading(false);
    }
  };

  const fundWallet = async () => {
    if (!walletAddress) return;
    setFundLoading(true);
    try {
      const res = await fetch(`https://friendbot.stellar.org?addr=${walletAddress}`);
      if (res.ok) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        await fetchBalance(walletAddress);
      } else {
        alert('Friendbot funding failed.');
      }
    } catch (error) {
      console.error('Funding error:', error);
    } finally {
      setFundLoading(false);
    }
  };

  const sendTip = async (e) => {
    e.preventDefault();
    if (!walletAddress || !destination || !amount) return;
    setLoading(true);
    setTxHash(null);

    try {
      const account = await server.loadAccount(walletAddress);
      const fee = await server.fetchBaseFee();
      let operation;

      // Check if destination exists
      try {
        await server.loadAccount(destination);
        operation = StellarSdk.Operation.payment({
          destination,
          asset: StellarSdk.Asset.native(),
          amount: amount.toString(),
        });
      } catch (e) {
        // Create account if it doesn't exist
        operation = StellarSdk.Operation.createAccount({
          destination,
          startingBalance: amount.toString(),
        });
      }

      const tx = new StellarSdk.TransactionBuilder(account, {
        fee: fee.toString(),
        networkPassphrase: StellarSdk.Networks.TESTNET,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const signedTxXdr = await signTransaction(tx.toXDR(), { network: 'TESTNET' });
      const signedTx = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, StellarSdk.Networks.TESTNET);
      
      const result = await server.submitTransaction(signedTx);
      setTxHash(result.hash);
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
      fetchBalance(walletAddress);
      setDestination('');
      setAmount('');
    } catch (error) {
      console.error('Transaction error:', error);
      alert('Transaction failed. See console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header panel">
        <h1>Stellar Pulse</h1>
        <p>White Belt Testnet Payment & Tip Portal</p>
      </header>

      {!walletAddress ? (
        <div className="panel connect-panel">
          <Wallet size={48} className="icon-pulse" />
          <h2>Connect Wallet</h2>
          <p>Connect your Freighter wallet to start sending tips on the Stellar Testnet.</p>
          <button onClick={connectWallet} className="primary-btn">
            Connect Freighter
          </button>
        </div>
      ) : (
        <div className="dashboard">
          <div className="panel wallet-panel">
            <div className="wallet-header">
              <ShieldCheck className="success-icon" size={24} />
              <h3>Wallet Connected</h3>
              <button onClick={disconnectWallet} className="icon-btn" title="Disconnect">
                <PowerOff size={20} />
              </button>
            </div>
            <p className="address">{walletAddress.substring(0, 8)}...{walletAddress.substring(48)}</p>
            
            <div className="balance-display">
              <span className="balance-amount">{balance || '0.00'}</span>
              <span className="balance-currency">XLM</span>
            </div>

            <div className="action-buttons">
              <button onClick={() => fetchBalance(walletAddress)} disabled={loading} className="secondary-btn">
                <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
              </button>
              {balance === '0.00' && (
                <button onClick={fundWallet} disabled={fundLoading} className="secondary-btn fund-btn">
                  <Droplets size={16} /> Fund (Friendbot)
                </button>
              )}
            </div>
          </div>

          <div className="panel send-panel">
            <h3>Send Tip</h3>
            <form onSubmit={sendTip}>
              <div className="form-group">
                <label>Destination Address</label>
                <input
                  type="text"
                  placeholder="G..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Amount (XLM)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.0000001"
                  min="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="primary-btn submit-btn" disabled={loading}>
                {loading ? 'Processing...' : <><Send size={18} /> Send XLM</>}
              </button>
            </form>
          </div>

          {txHash && (
            <div className="panel success-panel slide-up">
              <h3>🎉 Transaction Successful!</h3>
              <p>Your tip has been sent on the Stellar Testnet.</p>
              <a 
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank" 
                rel="noreferrer"
                className="explorer-link"
              >
                View on Stellar Expert <ExternalLink size={16} />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
