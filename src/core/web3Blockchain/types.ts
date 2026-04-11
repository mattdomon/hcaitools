/**
 * Web3 & Blockchain Integration Types
 * Complete type definitions for blockchain wallet management, smart contracts, and NFTs
 */

export type WalletType = 'hot' | 'cold' | 'hardware';
export type NetworkType = 'mainnet' | 'testnet' | 'devnet';
export type ChainType = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'bsc' | 'solana';
export type TransactionStatus = 'pending' | 'confirmed' | 'failed' | 'cancelled';
export type WalletStatus = 'active' | 'inactive' | 'locked' | 'compromised';
export type NFTType = ' ERC721' | 'ERC1155';
export type TokenStandard = 'ERC20' | 'ERC721' | 'ERC1155';
export type ContractInteractionType = 'read' | 'write';

export interface Wallet {
  walletId: string;
  address: string;
  type: WalletType;
  chain: ChainType;
  network: NetworkType;
  status: WalletStatus;
  label?: string;
  balance: Record<string, string>;
  tokens: TokenBalance[];
  nfts: NFTBalance[];
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface TokenBalance {
  tokenId: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  contractAddress: string;
  logoUrl?: string;
  priceUsd?: number;
  valueUsd?: number;
}

export interface NFTBalance {
  nftId: string;
  tokenId: string;
  contractAddress: string;
  name: string;
  symbol: string;
  type: NFTType;
  chain: ChainType;
  metadata: NFTMetadata;
  quantity: string;
  collectionName?: string;
}

export interface NFTMetadata {
  name: string;
  description?: string;
  image?: string;
  externalUrl?: string;
  attributes?: NFTAttribute[];
  animationUrl?: string;
}

export interface NFTAttribute {
  traitType: string;
  value: string | number;
  displayType?: string;
}

export interface Transaction {
  transactionId: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  gasUsed?: string;
  nonce: number;
  status: TransactionStatus;
  chain: ChainType;
  network: NetworkType;
  blockNumber?: number;
  blockHash?: string;
  timestamp: Date;
  confirmedAt?: Date;
  failedAt?: Date;
  data?: string;
  input?: string;
  receipt?: TransactionReceipt;
  metadata?: Record<string, unknown>;
}

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  blockHash: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  status: number;
  logs: LogEntry[];
  logsBloom: string;
}

export interface LogEntry {
  address: string;
  topics: string[];
  data: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  logIndex: number;
  removed: boolean;
}

export interface SmartContract {
  contractId: string;
  address: string;
  name: string;
  chain: ChainType;
  network: NetworkType;
  abi: ContractABI;
  bytecode?: string;
  deployedAt?: Date;
  creator?: string;
  metadata?: Record<string, unknown>;
}

export interface ContractABI {
  functions: ContractFunction[];
  events: ContractEvent[];
}

export interface ContractFunction {
  name: string;
  type: 'function' | 'constructor' | 'fallback' | 'receive';
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable';
  inputs: ContractParameter[];
  outputs: ContractParameter[];
  payable?: boolean;
  constant?: boolean;
}

export interface ContractEvent {
  name: string;
  type: 'event';
  anonymous?: boolean;
  inputs: ContractEventInput[];
}

export interface ContractParameter {
  name: string;
  type: string;
  indexed?: boolean;
  components?: ContractParameter[];
  internalType?: string;
}

export interface ContractEventInput extends ContractParameter {
  indexed: boolean;
}

export interface ContractInteraction {
  interactionId: string;
  contractId: string;
  functionName: string;
  type: ContractInteractionType;
  parameters: Record<string, unknown>;
  result?: unknown;
  gasEstimate?: string;
  gasUsed?: string;
  status: 'pending' | 'success' | 'failed';
  error?: string;
  timestamp: Date;
}

export interface NFTMintRequest {
  contractAddress: string;
  to: string;
  tokenId?: string;
  uri: string;
  quantity?: number;
  royalties?: number;
  metadata: NFTMetadata;
}

export interface NFTMintResult {
  mintId: string;
  transactionId: string;
  tokenId: string;
  contractAddress: string;
  owner: string;
  tokenUri: string;
  metadata: NFTMetadata;
  timestamp: Date;
}

export interface NFTTransferRequest {
  contractAddress: string;
  from: string;
  to: string;
  tokenId: string;
  quantity?: number;
  data?: string;
}

export interface NFTTransferResult {
  transferId: string;
  transactionId: string;
  tokenId: string;
  contractAddress: string;
  from: string;
  to: string;
  quantity: string;
  timestamp: Date;
}

export interface WalletConnection {
  connectionId: string;
  walletId: string;
  userId: string;
  dappName?: string;
  dappUrl?: string;
  chain: ChainType;
  network: NetworkType;
  permissions: WalletPermission[];
  connectedAt: Date;
  lastConnectedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export interface WalletPermission {
  permission: 'read' | 'write' | 'sign' | 'switchChain' | 'custom';
  resource?: string;
  expiresAt?: Date;
}

export interface WalletBalance {
  walletId: string;
  address: string;
  chain: ChainType;
  network: NetworkType;
  nativeBalance: string;
  nativeBalanceFormatted: string;
  tokenBalances: TokenBalance[];
  totalValueUsd?: number;
  lastUpdated: Date;
}

export interface GasEstimate {
  gasPrice: string;
  gasLimit: string;
  gasEstimate: string;
  cost: string;
  costFormatted: string;
  costUsd?: number;
  estimatedTimeMs: number;
}

export interface ChainConfig {
  chain: ChainType;
  network: NetworkType;
  chainId: number;
  name: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isSupported: boolean;
}

export interface WalletSignature {
  signatureId: string;
  walletId: string;
  message: string;
  signature: string;
  signedAt: Date;
  verification?: {
    isValid: boolean;
    verifiedAt?: Date;
  };
}

export interface Web3Service {
  // Wallet Management
  createWallet(wallet: Omit<Wallet, 'walletId' | 'createdAt' | 'updatedAt'>): Promise<Wallet>;
  getWallet(walletId: string): Promise<Wallet | null>;
  getWalletByAddress(address: string): Promise<Wallet | null>;
  getWalletsByUser(userId: string): Promise<Wallet[]>;
  updateWallet(walletId: string, updates: Partial<Wallet>): Promise<Wallet>;
  deleteWallet(walletId: string): Promise<void>;
  getWalletBalance(walletId: string, chain?: ChainType): Promise<WalletBalance>;
  getWalletBalanceByAddress(address: string, chain: ChainType, network: NetworkType): Promise<WalletBalance>;

  // Transaction Management
  createTransaction(tx: Omit<Transaction, 'transactionId' | 'timestamp'>): Promise<Transaction>;
  getTransaction(transactionId: string): Promise<Transaction | null>;
  getTransactionByHash(hash: string): Promise<Transaction | null>;
  getTransactionsByWallet(walletId: string, options?: GetTransactionsOptions): Promise<TransactionPage>;
  getTransactionsByAddress(address: string, chain: ChainType, network: NetworkType): Promise<Transaction[]>;
  updateTransactionStatus(transactionId: string, status: TransactionStatus, receipt?: TransactionReceipt): Promise<Transaction>;
  signTransaction(transactionId: string, signature: string): Promise<Transaction>;
  cancelTransaction(transactionId: string): Promise<Transaction>;

  // Smart Contract Management
  deployContract(contract: Omit<SmartContract, 'contractId' | 'deployedAt'>): Promise<SmartContract>;
  getContract(contractId: string): Promise<SmartContract | null>;
  getContractByAddress(address: string, chain: ChainType): Promise<SmartContract | null>;
  getContractsByWallet(walletId: string): Promise<SmartContract[]>;
  interactWithContract(interaction: Omit<ContractInteraction, 'interactionId' | 'timestamp' | 'status'>): Promise<ContractInteraction>;

  // NFT Operations
  mintNFT(mint: NFTMintRequest, walletId: string): Promise<NFTMintResult>;
  transferNFT(transfer: NFTTransferRequest, walletId: string): Promise<NFTTransferResult>;
  getNFTsByWallet(walletId: string): Promise<NFTBalance[]>;
  getNFTsByAddress(address: string, chain: ChainType): Promise<NFTBalance[]>;
  getNFTMetadata(contractAddress: string, tokenId: string, chain: ChainType): Promise<NFTMetadata | null>;

  // Wallet Connection
  connectWallet(connection: Omit<WalletConnection, 'connectionId' | 'connectedAt' | 'isActive'>): Promise<WalletConnection>;
  disconnectWallet(connectionId: string): Promise<void>;
  getWalletConnections(walletId: string): Promise<WalletConnection[]>;
  getActiveConnections(userId: string): Promise<WalletConnection[]>;

  // Gas & Estimation
  estimateGas(transaction: Omit<Transaction, 'transactionId' | 'timestamp'>): Promise<GasEstimate>;
  getCurrentGasPrice(chain: ChainType, network: NetworkType): Promise<GasEstimate>;

  // Signing
  signMessage(walletId: string, message: string): Promise<WalletSignature>;
  verifySignature(signatureId: string): Promise<WalletSignature>;

  // Chain Info
  getChainConfig(chain: ChainType, network: NetworkType): ChainConfig;
  getSupportedChains(): ChainConfig[];
}

export interface GetTransactionsOptions {
  chain?: ChainType;
  network?: NetworkType;
  status?: TransactionStatus;
  limit?: number;
  cursor?: string;
  since?: Date;
  until?: Date;
}

export interface TransactionPage {
  transactions: Transaction[];
  nextCursor?: string;
  prevCursor?: string;
  hasMore: boolean;
  totalCount: number;
}

export interface TokenSwapQuote {
  quoteId: string;
  fromToken: TokenBalance;
  toToken: TokenBalance;
  fromAmount: string;
  toAmount: string;
  exchangeRate: string;
  priceImpact: number;
  gasEstimate: GasEstimate;
  validUntil: Date;
  route: string[];
}

export interface StakingPosition {
  positionId: string;
  walletId: string;
  validatorAddress: string;
  chain: ChainType;
  network: NetworkType;
  amount: string;
  amountFormatted: string;
  rewards: string;
  rewardsFormatted: string;
  APY: number;
  startDate: Date;
  unlockDate?: Date;
  status: 'active' | 'unbonding' | 'withdrawn';
}

export interface WalletAnalytics {
  walletId: string;
  address: string;
  totalValueUsd: number;
  totalTransactions: number;
  totalNFTs: number;
  totalTokens: number;
  transactionByChain: Record<ChainType, number>;
  transactionByMonth: Record<string, number>;
  gasSpentUsd: number;
  lastActivity: Date;
}
