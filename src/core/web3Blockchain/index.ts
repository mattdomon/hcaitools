/**
 * Web3 & Blockchain Integration Module
 * Complete blockchain wallet management, smart contracts, and NFT operations
 */

export {
  WalletType,
  NetworkType,
  ChainType,
  TransactionStatus,
  WalletStatus,
  NFTType,
  TokenStandard,
  ContractInteractionType,
  Wallet,
  TokenBalance,
  NFTBalance,
  NFTMetadata,
  NFTAttribute,
  Transaction,
  TransactionReceipt,
  LogEntry,
  SmartContract,
  ContractABI,
  ContractFunction,
  ContractEvent,
  ContractParameter,
  ContractEventInput,
  ContractInteraction,
  NFTMintRequest,
  NFTMintResult,
  NFTTransferRequest,
  NFTTransferResult,
  WalletConnection,
  WalletPermission,
  WalletBalance,
  GasEstimate,
  ChainConfig,
  WalletSignature,
  Web3Service,
  GetTransactionsOptions,
  TransactionPage,
  TokenSwapQuote,
  StakingPosition,
  WalletAnalytics,
} from './types';

export { Web3BlockchainService, createWeb3Service } from './web3Blockchain';

import { Web3BlockchainService } from './web3Blockchain';
import {
  Wallet,
  Transaction,
  SmartContract,
  ContractInteraction,
  NFTMintRequest,
  NFTTransferRequest,
  NFTBalance,
  WalletConnection,
  GasEstimate,
  ChainConfig,
  WalletSignature,
  GetTransactionsOptions,
  TransactionPage,
  WalletBalance,
} from './types';

export class Web3BlockchainManus {
  private service: Web3BlockchainService;

  constructor() {
    this.service = new Web3BlockchainService();
  }

  async createWallet(
    type: Wallet['type'],
    chain: Wallet['chain'],
    network: Wallet['network'],
    address: string,
    userId: string,
    label?: string
  ): Promise<Wallet> {
    return this.service.createWallet({
      type,
      chain,
      network,
      address,
      status: 'active',
      label,
      balance: {},
      tokens: [],
      nfts: [],
      metadata: { userId },
    });
  }

  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    return this.service.getWalletBalance(walletId);
  }

  async getWalletBalanceByChain(address: string, chain: ChainConfig['chain'], network: ChainConfig['network']): Promise<WalletBalance> {
    return this.service.getWalletBalanceByAddress(address, chain, network);
  }

  async sendTransaction(
    from: string,
    to: string,
    value: string,
    chain: ChainConfig['chain'],
    network: ChainConfig['network'],
    data?: string
  ): Promise<Transaction> {
    return this.service.createTransaction({
      hash: this.generateMockHash(),
      from,
      to,
      value,
      gasPrice: '30000000000',
      gasLimit: '21000',
      nonce: 0,
      status: 'pending',
      chain,
      network,
      data,
    });
  }

  async signTransaction(transactionId: string): Promise<Transaction> {
    const signature = this.generateMockHash();
    return this.service.signTransaction(transactionId, signature);
  }

  async deploySmartContract(
    name: string,
    address: string,
    chain: ChainConfig['chain'],
    network: ChainConfig['network'],
    abi: SmartContract['abi'],
    creatorWalletId: string
  ): Promise<SmartContract> {
    return this.service.deployContract({
      name,
      address,
      chain,
      network,
      abi,
      creator: creatorWalletId,
    });
  }

  async mintNFT(mintRequest: NFTMintRequest, walletId: string): Promise<import('./types').NFTMintResult> {
    return this.service.mintNFT(mintRequest, walletId);
  }

  async transferNFT(transferRequest: NFTTransferRequest, walletId: string): Promise<import('./types').NFTTransferResult> {
    return this.service.transferNFT(transferRequest, walletId);
  }

  async getNFTs(walletId: string): Promise<NFTBalance[]> {
    return this.service.getNFTsByWallet(walletId);
  }

  async connectWallet(
    walletId: string,
    userId: string,
    dappName: string,
    chain: ChainConfig['chain'],
    network: ChainConfig['network']
  ): Promise<WalletConnection> {
    return this.service.connectWallet({
      walletId,
      userId,
      dappName,
      chain,
      network,
      permissions: [
        { permission: 'read' },
        { permission: 'write' },
        { permission: 'sign' },
      ],
    });
  }

  async disconnectWallet(connectionId: string): Promise<void> {
    return this.service.disconnectWallet(connectionId);
  }

  async getActiveConnections(userId: string): Promise<WalletConnection[]> {
    return this.service.getActiveConnections(userId);
  }

  async estimateTransactionGas(
    from: string,
    to: string,
    value: string,
    chain: ChainConfig['chain'],
    network: ChainConfig['network'],
    data?: string
  ): Promise<GasEstimate> {
    const tx = {
      hash: '',
      from,
      to,
      value,
      gasPrice: '0',
      gasLimit: '0',
      nonce: 0,
      status: 'pending' as const,
      chain,
      network,
      data,
    };
    return this.service.estimateGas(tx);
  }

  async getCurrentGasPrice(chain: ChainConfig['chain'], network: ChainConfig['network']): Promise<GasEstimate> {
    return this.service.getCurrentGasPrice(chain, network);
  }

  async signMessage(walletId: string, message: string): Promise<WalletSignature> {
    return this.service.signMessage(walletId, message);
  }

  async verifySignature(signatureId: string): Promise<WalletSignature> {
    return this.service.verifySignature(signatureId);
  }

  getChainConfig(chain: ChainConfig['chain'], network: ChainConfig['network']): ChainConfig {
    return this.service.getChainConfig(chain, network);
  }

  getSupportedChains(): ChainConfig[] {
    return this.service.getSupportedChains();
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.service.getTransaction(transactionId);
  }

  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    return this.service.getTransactionByHash(hash);
  }

  async getTransactions(walletId: string, options?: GetTransactionsOptions): Promise<TransactionPage> {
    return this.service.getTransactionsByWallet(walletId, options);
  }

  async interactWithContract(
    contractId: string,
    functionName: string,
    type: ContractInteraction['type'],
    parameters: Record<string, unknown>,
    _chain: ChainConfig['chain'],
    _network: ChainConfig['network']
  ): Promise<ContractInteraction> {
    return this.service.interactWithContract({
      contractId,
      functionName,
      type,
      parameters,
    });
  }

  private generateMockHash(): string {
    return '0x' + crypto.randomBytes(32).toString('hex');
  }
}

import crypto from 'crypto';
