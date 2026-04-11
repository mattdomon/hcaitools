/**
 * Web3 & Blockchain Service Implementation
 * Complete blockchain wallet management, smart contracts, and NFT operations
 */

import crypto from 'crypto';
import {
  Wallet,
  NetworkType,
  ChainType,
  Transaction,
  TransactionStatus,
  TransactionReceipt,
  SmartContract,
  ContractInteraction,
  NFTMintRequest,
  NFTMintResult,
  NFTTransferRequest,
  NFTTransferResult,
  NFTBalance,
  NFTMetadata,
  WalletConnection,
  WalletBalance,
  GasEstimate,
  ChainConfig,
  WalletSignature,
  Web3Service,
  GetTransactionsOptions,
  TransactionPage,
  TokenBalance,
} from './types';

const DEFAULT_CHAIN_CONFIGS: Record<ChainType, Record<NetworkType, ChainConfig>> = {
  ethereum: {
    mainnet: {
      chain: 'ethereum',
      network: 'mainnet',
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://mainnet.infura.io/v3/',
      blockExplorerUrl: 'https://etherscan.io',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
    testnet: {
      chain: 'ethereum',
      network: 'testnet',
      chainId: 5,
      name: 'Goerli Testnet',
      rpcUrl: 'https://goerli.infura.io/v3/',
      blockExplorerUrl: 'https://goerli.etherscan.io',
      nativeCurrency: { name: 'Goerli Ether', symbol: 'GoerliETH', decimals: 18 },
      isSupported: true,
    },
    devnet: {
      chain: 'ethereum',
      network: 'devnet',
      chainId: 1337,
      name: 'Ethereum Devnet',
      rpcUrl: 'http://localhost:8545',
      blockExplorerUrl: '',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
  },
  polygon: {
    mainnet: {
      chain: 'polygon',
      network: 'mainnet',
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrl: 'https://polygon-rpc.com',
      blockExplorerUrl: 'https://polygonscan.com',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      isSupported: true,
    },
    testnet: {
      chain: 'polygon',
      network: 'testnet',
      chainId: 80001,
      name: 'Mumbai Testnet',
      rpcUrl: 'https://rpc-mumbai.maticvigil.com',
      blockExplorerUrl: 'https://mumbai.polygonscan.com',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      isSupported: true,
    },
    devnet: {
      chain: 'polygon',
      network: 'devnet',
      chainId: 1381,
      name: 'Polygon Devnet',
      rpcUrl: 'http://localhost:7545',
      blockExplorerUrl: '',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      isSupported: true,
    },
  },
  arbitrum: {
    mainnet: {
      chain: 'arbitrum',
      network: 'mainnet',
      chainId: 42161,
      name: 'Arbitrum One',
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      blockExplorerUrl: 'https://arbiscan.io',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
    testnet: {
      chain: 'arbitrum',
      network: 'testnet',
      chainId: 421613,
      name: 'Arbitrum Goerli',
      rpcUrl: 'https://goerli-rollup.arbitrum.io/rpc',
      blockExplorerUrl: 'https://goerli.arbiscan.io',
      nativeCurrency: { name: 'Goerli Ether', symbol: 'GoerliETH', decimals: 18 },
      isSupported: true,
    },
    devnet: {
      chain: 'arbitrum',
      network: 'devnet',
      chainId: 42170,
      name: 'Arbitrum Devnet',
      rpcUrl: 'http://localhost:8547',
      blockExplorerUrl: '',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
  },
  optimism: {
    mainnet: {
      chain: 'optimism',
      network: 'mainnet',
      chainId: 10,
      name: 'Optimism Mainnet',
      rpcUrl: 'https://mainnet.optimism.io',
      blockExplorerUrl: 'https://optimistic.etherscan.io',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
    testnet: {
      chain: 'optimism',
      network: 'testnet',
      chainId: 420,
      name: 'Optimism Goerli',
      rpcUrl: 'https://goerli.optimism.io',
      blockExplorerUrl: 'https://goerli-optimism.etherscan.io',
      nativeCurrency: { name: 'Goerli Ether', symbol: 'GoerliETH', decimals: 18 },
      isSupported: true,
    },
    devnet: {
      chain: 'optimism',
      network: 'devnet',
      chainId: 42069,
      name: 'Optimism Devnet',
      rpcUrl: 'http://localhost:8548',
      blockExplorerUrl: '',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      isSupported: true,
    },
  },
  bsc: {
    mainnet: {
      chain: 'bsc',
      network: 'mainnet',
      chainId: 56,
      name: 'BNB Smart Chain',
      rpcUrl: 'https://bsc-dataseed.binance.org',
      blockExplorerUrl: 'https://bscscan.com',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      isSupported: true,
    },
    testnet: {
      chain: 'bsc',
      network: 'testnet',
      chainId: 97,
      name: 'BNB Smart Chain Testnet',
      rpcUrl: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      blockExplorerUrl: 'https://testnet.bscscan.com',
      nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
      isSupported: true,
    },
    devnet: {
      chain: 'bsc',
      network: 'devnet',
      chainId: 1399,
      name: 'BNB Devnet',
      rpcUrl: 'http://localhost:8549',
      blockExplorerUrl: '',
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      isSupported: true,
    },
  },
  solana: {
    mainnet: {
      chain: 'solana',
      network: 'mainnet',
      chainId: 101,
      name: 'Solana Mainnet',
      rpcUrl: 'https://api.mainnet-beta.solana.com',
      blockExplorerUrl: 'https://explorer.solana.com',
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      isSupported: true,
    },
    testnet: {
      chain: 'solana',
      network: 'testnet',
      chainId: 102,
      name: 'Solana Testnet',
      rpcUrl: 'https://api.testnet.solana.com',
      blockExplorerUrl: 'https://explorer.solana.com?cluster=testnet',
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      isSupported: true,
    },
    devnet: {
      chain: 'solana',
      network: 'devnet',
      chainId: 103,
      name: 'Solana Devnet',
      rpcUrl: 'https://api.devnet.solana.com',
      blockExplorerUrl: 'https://explorer.solana.com?cluster=devnet',
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      isSupported: true,
    },
  },
};

export class Web3BlockchainService implements Web3Service {
  private wallets: Map<string, Wallet> = new Map();
  private walletsByAddress: Map<string, Wallet> = new Map();
  private transactions: Map<string, Transaction> = new Map();
  private transactionsByHash: Map<string, Transaction> = new Map();
  private walletTransactions: Map<string, Set<string>> = new Map();
  private addressTransactions: Map<string, Set<string>> = new Map();
  private contracts: Map<string, SmartContract> = new Map();
  private contractsByAddress: Map<string, SmartContract> = new Map();
  private contractInteractions: Map<string, ContractInteraction> = new Map();
  private walletConnections: Map<string, WalletConnection> = new Map();
  private userConnections: Map<string, Set<string>> = new Map();
  private walletUsers: Map<string, string> = new Map();
  private signatures: Map<string, WalletSignature> = new Map();

  async createWallet(wallet: Omit<Wallet, 'walletId' | 'createdAt' | 'updatedAt'>): Promise<Wallet> {
    const fullWallet: Wallet = {
      ...wallet,
      walletId: this.generateId('wallet'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.wallets.set(fullWallet.walletId, fullWallet);
    this.walletsByAddress.set(fullWallet.address.toLowerCase(), fullWallet);
    this.walletTransactions.set(fullWallet.walletId, new Set());

    return fullWallet;
  }

  async getWallet(walletId: string): Promise<Wallet | null> {
    return this.wallets.get(walletId) || null;
  }

  async getWalletByAddress(address: string): Promise<Wallet | null> {
    return this.walletsByAddress.get(address.toLowerCase()) || null;
  }

  async getWalletsByUser(userId: string): Promise<Wallet[]> {
    const result: Wallet[] = [];
    for (const [walletId, wallet] of this.wallets) {
      if (this.walletUsers.get(walletId) === userId) {
        result.push(wallet);
      }
    }
    return result;
  }

  async updateWallet(walletId: string, updates: Partial<Wallet>): Promise<Wallet> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const updated: Wallet = {
      ...wallet,
      ...updates,
      walletId,
      createdAt: wallet.createdAt,
      updatedAt: new Date(),
    };

    this.wallets.set(walletId, updated);
    if (updated.address.toLowerCase() !== wallet.address.toLowerCase()) {
      this.walletsByAddress.delete(wallet.address.toLowerCase());
      this.walletsByAddress.set(updated.address.toLowerCase(), updated);
    }

    return updated;
  }

  async deleteWallet(walletId: string): Promise<void> {
    const wallet = this.wallets.get(walletId);
    if (wallet) {
      this.walletsByAddress.delete(wallet.address.toLowerCase());
      this.wallets.delete(walletId);
    }
  }

  async getWalletBalance(walletId: string, _chain?: ChainType): Promise<WalletBalance> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return this.getWalletBalanceByAddress(wallet.address, wallet.chain, wallet.network);
  }

  async getWalletBalanceByAddress(address: string, chain: ChainType, network: NetworkType): Promise<WalletBalance> {
    const config = this.getChainConfig(chain, network);
    const nativeBalance = this.simulateNativeBalance(address, config);

    return {
      walletId: this.generateId('wallet'),
      address,
      chain,
      network,
      nativeBalance: nativeBalance.toString(),
      nativeBalanceFormatted: this.formatBalance(nativeBalance, config.nativeCurrency.decimals),
      tokenBalances: this.getSimulatedTokenBalances(address, chain),
      totalValueUsd: this.calculateTotalValueUsd(nativeBalance, chain),
      lastUpdated: new Date(),
    };
  }

  async createTransaction(tx: Omit<Transaction, 'transactionId' | 'timestamp'>): Promise<Transaction> {
    const fullTx: Transaction = {
      ...tx,
      transactionId: this.generateId('tx'),
      timestamp: new Date(),
    };

    this.transactions.set(fullTx.transactionId, fullTx);
    this.transactionsByHash.set(fullTx.hash.toLowerCase(), fullTx);

    const fromWallet = this.walletsByAddress.get(tx.from.toLowerCase());
    if (fromWallet) {
      const walletTxSet = this.walletTransactions.get(fromWallet.walletId);
      if (walletTxSet) {
        walletTxSet.add(fullTx.transactionId);
      }
    }

    const addrTxSet = this.addressTransactions.get(tx.from.toLowerCase());
    if (addrTxSet) {
      addrTxSet.add(fullTx.transactionId);
    } else {
      this.addressTransactions.set(tx.from.toLowerCase(), new Set([fullTx.transactionId]));
    }

    return fullTx;
  }

  async getTransaction(transactionId: string): Promise<Transaction | null> {
    return this.transactions.get(transactionId) || null;
  }

  async getTransactionByHash(hash: string): Promise<Transaction | null> {
    return this.transactionsByHash.get(hash.toLowerCase()) || null;
  }

  async getTransactionsByWallet(walletId: string, options?: GetTransactionsOptions): Promise<TransactionPage> {
    const walletTxIds = this.walletTransactions.get(walletId);
    if (!walletTxIds) {
      return {
        transactions: [],
        hasMore: false,
        totalCount: 0,
      };
    }

    let transactions = Array.from(walletTxIds)
      .map((id) => this.transactions.get(id))
      .filter((tx): tx is Transaction => tx !== undefined);

    if (options?.chain) {
      transactions = transactions.filter((tx) => tx.chain === options.chain);
    }

    if (options?.network) {
      transactions = transactions.filter((tx) => tx.network === options.network);
    }

    if (options?.status) {
      transactions = transactions.filter((tx) => tx.status === options.status);
    }

    if (options?.since) {
      transactions = transactions.filter((tx) => tx.timestamp >= options.since!);
    }

    if (options?.until) {
      transactions = transactions.filter((tx) => tx.timestamp <= options.until!);
    }

    transactions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const limit = options?.limit || 50;
    let cursorIndex = 0;

    if (options?.cursor) {
      cursorIndex = transactions.findIndex((tx) => tx.transactionId === options.cursor);
      if (cursorIndex !== -1) {
        cursorIndex++;
      }
    }

    const paginatedTxs = transactions.slice(cursorIndex, cursorIndex + limit);
    const hasMore = transactions.length > cursorIndex + limit;

    return {
      transactions: paginatedTxs,
      hasMore,
      totalCount: transactions.length,
      nextCursor: hasMore ? paginatedTxs[paginatedTxs.length - 1]?.transactionId : undefined,
    };
  }

  async getTransactionsByAddress(address: string, chain: ChainType, network: NetworkType): Promise<Transaction[]> {
    const addrTxIds = this.addressTransactions.get(address.toLowerCase());
    if (!addrTxIds) {
      return [];
    }

    return Array.from(addrTxIds)
      .map((id) => this.transactions.get(id))
      .filter((tx): tx is Transaction => tx !== undefined && tx.chain === chain && tx.network === network)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async updateTransactionStatus(transactionId: string, status: TransactionStatus, receipt?: TransactionReceipt): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    tx.status = status;
    if (receipt) {
      tx.receipt = receipt;
      tx.blockNumber = receipt.blockNumber;
      tx.blockHash = receipt.blockHash;
      tx.gasUsed = receipt.gasUsed;
    }

    if (status === 'confirmed') {
      tx.confirmedAt = new Date();
    } else if (status === 'failed') {
      tx.failedAt = new Date();
    }

    this.transactions.set(transactionId, tx);
    return tx;
  }

  async signTransaction(transactionId: string, _signature: string): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (tx.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not pending`);
    }

    tx.status = 'confirmed';
    tx.confirmedAt = new Date();
    this.transactions.set(transactionId, tx);

    return tx;
  }

  async cancelTransaction(transactionId: string): Promise<Transaction> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    if (tx.status !== 'pending') {
      throw new Error(`Transaction ${transactionId} is not pending and cannot be cancelled`);
    }

    tx.status = 'cancelled';
    this.transactions.set(transactionId, tx);

    return tx;
  }

  async deployContract(contract: Omit<SmartContract, 'contractId' | 'deployedAt'>): Promise<SmartContract> {
    const fullContract: SmartContract = {
      ...contract,
      contractId: this.generateId('contract'),
      deployedAt: new Date(),
    };

    this.contracts.set(fullContract.contractId, fullContract);
    this.contractsByAddress.set(fullContract.address.toLowerCase(), fullContract);

    return fullContract;
  }

  async getContract(contractId: string): Promise<SmartContract | null> {
    return this.contracts.get(contractId) || null;
  }

  async getContractByAddress(address: string, chain: ChainType): Promise<SmartContract | null> {
    const contract = this.contractsByAddress.get(address.toLowerCase());
    if (contract && contract.chain === chain) {
      return contract;
    }
    return null;
  }

  async getContractsByWallet(walletId: string): Promise<SmartContract[]> {
    const contracts: SmartContract[] = [];
    for (const contract of this.contracts.values()) {
      if (contract.creator === walletId) {
        contracts.push(contract);
      }
    }
    return contracts;
  }

  async interactWithContract(interaction: Omit<ContractInteraction, 'interactionId' | 'timestamp' | 'status'>): Promise<ContractInteraction> {
    const fullInteraction: ContractInteraction = {
      ...interaction,
      interactionId: this.generateId('interaction'),
      timestamp: new Date(),
      status: 'pending',
    };

    this.contractInteractions.set(fullInteraction.interactionId, fullInteraction);

    try {
      const result = this.simulateContractCall(interaction.functionName, interaction.parameters);
      fullInteraction.result = result;
      fullInteraction.status = 'success';
      fullInteraction.gasEstimate = '21000';
      fullInteraction.gasUsed = '21000';
    } catch (error) {
      fullInteraction.status = 'failed';
      fullInteraction.error = error instanceof Error ? error.message : 'Unknown error';
    }

    this.contractInteractions.set(fullInteraction.interactionId, fullInteraction);
    return fullInteraction;
  }

  async mintNFT(mint: NFTMintRequest, walletId: string): Promise<NFTMintResult> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const tokenId = mint.tokenId || this.generateId('token');
    const mintId = this.generateId('mint');
    const transactionId = this.generateId('tx');

    const result: NFTMintResult = {
      mintId,
      transactionId,
      tokenId,
      contractAddress: mint.contractAddress,
      owner: mint.to,
      tokenUri: mint.uri,
      metadata: mint.metadata,
      timestamp: new Date(),
    };

    return result;
  }

  async transferNFT(transfer: NFTTransferRequest, walletId: string): Promise<NFTTransferResult> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const transferId = this.generateId('transfer');
    const transactionId = this.generateId('tx');

    const result: NFTTransferResult = {
      transferId,
      transactionId,
      tokenId: transfer.tokenId,
      contractAddress: transfer.contractAddress,
      from: transfer.from,
      to: transfer.to,
      quantity: transfer.quantity?.toString() || '1',
      timestamp: new Date(),
    };

    return result;
  }

  async getNFTsByWallet(walletId: string): Promise<NFTBalance[]> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    return wallet.nfts;
  }

  async getNFTsByAddress(address: string, chain: ChainType): Promise<NFTBalance[]> {
    const wallet = this.walletsByAddress.get(address.toLowerCase());
    if (!wallet) {
      return [];
    }

    return wallet.nfts.filter((nft) => nft.chain === chain);
  }

  async getNFTMetadata(contractAddress: string, tokenId: string, chain: ChainType): Promise<NFTMetadata | null> {
    const contract = this.contractsByAddress.get(contractAddress.toLowerCase());
    if (!contract || contract.chain !== chain) {
      return null;
    }

    return {
      name: `NFT #${tokenId}`,
      description: `Token from contract ${contractAddress}`,
      image: `https://example.com/nft/${contractAddress}/${tokenId}.png`,
      attributes: [],
    };
  }

  async connectWallet(connection: Omit<WalletConnection, 'connectionId' | 'connectedAt' | 'isActive'>): Promise<WalletConnection> {
    const fullConnection: WalletConnection = {
      ...connection,
      connectionId: this.generateId('conn'),
      connectedAt: new Date(),
      isActive: true,
    };

    this.walletConnections.set(fullConnection.connectionId, fullConnection);

    const userConns = this.userConnections.get(connection.userId);
    if (userConns) {
      userConns.add(fullConnection.connectionId);
    } else {
      this.userConnections.set(connection.userId, new Set([fullConnection.connectionId]));
    }

    return fullConnection;
  }

  async disconnectWallet(connectionId: string): Promise<void> {
    const connection = this.walletConnections.get(connectionId);
    if (connection) {
      connection.isActive = false;
      this.walletConnections.set(connectionId, connection);
    }
  }

  async getWalletConnections(walletId: string): Promise<WalletConnection[]> {
    const connections: WalletConnection[] = [];
    for (const conn of this.walletConnections.values()) {
      if (conn.walletId === walletId && conn.isActive) {
        connections.push(conn);
      }
    }
    return connections;
  }

  async getActiveConnections(userId: string): Promise<WalletConnection[]> {
    const connIds = this.userConnections.get(userId);
    if (!connIds) {
      return [];
    }

    return Array.from(connIds)
      .map((id) => this.walletConnections.get(id))
      .filter((conn): conn is WalletConnection => conn !== undefined && conn.isActive);
  }

  async estimateGas(transaction: Omit<Transaction, 'transactionId' | 'timestamp'>): Promise<GasEstimate> {
    const startTime = Date.now();
    const gasPrice = this.simulateGasPrice(transaction.chain);
    const gasLimit = this.simulateGasLimit(transaction);
    const gasEstimate = (BigInt(gasLimit) * BigInt(gasPrice)).toString();
    const config = this.getChainConfig(transaction.chain, transaction.network);

    return {
      gasPrice,
      gasLimit,
      gasEstimate,
      cost: gasEstimate,
      costFormatted: this.formatBalance(gasEstimate, config.nativeCurrency.decimals),
      costUsd: this.calculateGasCostUsd(gasEstimate, transaction.chain),
      estimatedTimeMs: Date.now() - startTime + Math.random() * 1000,
    };
  }

  async getCurrentGasPrice(chain: ChainType, network: NetworkType): Promise<GasEstimate> {
    const startTime = Date.now();
    const gasPrice = this.simulateGasPrice(chain);
    const config = this.getChainConfig(chain, network);

    return {
      gasPrice,
      gasLimit: '21000',
      gasEstimate: gasPrice,
      cost: gasPrice,
      costFormatted: this.formatBalance(gasPrice, config.nativeCurrency.decimals),
      costUsd: this.calculateGasCostUsd(gasPrice, chain),
      estimatedTimeMs: Date.now() - startTime,
    };
  }

  async signMessage(walletId: string, message: string): Promise<WalletSignature> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error(`Wallet ${walletId} not found`);
    }

    const signatureId = this.generateId('sig');
    const signature = this.simulateSignature(message, wallet.address);

    const walletSignature: WalletSignature = {
      signatureId,
      walletId,
      message,
      signature,
      signedAt: new Date(),
      verification: {
        isValid: true,
        verifiedAt: new Date(),
      },
    };

    this.signatures.set(signatureId, walletSignature);

    return walletSignature;
  }

  async verifySignature(signatureId: string): Promise<WalletSignature> {
    const signature = this.signatures.get(signatureId);
    if (!signature) {
      throw new Error(`Signature ${signatureId} not found`);
    }

    signature.verification = {
      isValid: true,
      verifiedAt: new Date(),
    };

    this.signatures.set(signatureId, signature);
    return signature;
  }

  getChainConfig(chain: ChainType, network: NetworkType): ChainConfig {
    const config = DEFAULT_CHAIN_CONFIGS[chain]?.[network];
    if (!config) {
      return DEFAULT_CHAIN_CONFIGS.ethereum.mainnet;
    }
    return config;
  }

  getSupportedChains(): ChainConfig[] {
    const configs: ChainConfig[] = [];
    for (const chainConfigs of Object.values(DEFAULT_CHAIN_CONFIGS)) {
      for (const config of Object.values(chainConfigs)) {
        if (config.isSupported) {
          configs.push(config);
        }
      }
    }
    return configs;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private simulateNativeBalance(address: string, _config: ChainConfig): bigint {
    const hash = this.hashAddress(address);
    return BigInt(hash) % 1000000000000000000n;
  }

  private hashAddress(address: string): number {
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      const char = address.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  private formatBalance(balance: string | bigint, decimals: number): string {
    const bal = typeof balance === 'string' ? BigInt(balance) : balance;
    const divisor = BigInt(10 ** decimals);
    const integerPart = bal / divisor;
    const fractionalPart = bal % divisor;
    return `${integerPart}.${fractionalPart.toString().padStart(decimals, '0').slice(0, 4)}`;
  }

  private getSimulatedTokenBalances(address: string, chain: ChainType): TokenBalance[] {
    const hash = this.hashAddress(address);
    if (hash % 3 === 0) {
      return [];
    }

    const chainTokens: Record<ChainType, TokenBalance[]> = {
      ethereum: [
        {
          tokenId: this.generateId('token'),
          symbol: 'USDC',
          name: 'USD Coin',
          decimals: 6,
          balance: (hash * 1000000).toString(),
          balanceFormatted: `${hash * 1000}.00`,
          contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
          priceUsd: 1.0,
          valueUsd: hash * 1000,
        },
        {
          tokenId: this.generateId('token'),
          symbol: 'DAI',
          name: 'Dai Stablecoin',
          decimals: 18,
          balance: (BigInt(hash) * 1000000000000000000n).toString(),
          balanceFormatted: `${hash * 100}.0000`,
          contractAddress: '0x6B175474E89094C44Da98b954EescdeCB5c811',
          priceUsd: 1.0,
          valueUsd: hash * 100,
        },
      ],
      polygon: [
        {
          tokenId: this.generateId('token'),
          symbol: 'USDT',
          name: 'Tether USD',
          decimals: 6,
          balance: (hash * 1000000).toString(),
          balanceFormatted: `${hash * 1000}.00`,
          contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
          priceUsd: 1.0,
          valueUsd: hash * 1000,
        },
      ],
      arbitrum: [
        {
          tokenId: this.generateId('token'),
          symbol: 'ARB',
          name: 'Arbitrum',
          decimals: 18,
          balance: (BigInt(hash) * 1000000000000000000n).toString(),
          balanceFormatted: `${hash * 10}.0000`,
          contractAddress: '0xB50721BCf8B1B1dA12c2De7b2Ce0b880fAc8498B',
          priceUsd: 1.2,
          valueUsd: hash * 12,
        },
      ],
      optimism: [],
      bsc: [
        {
          tokenId: this.generateId('token'),
          symbol: 'CAKE',
          name: 'PancakeSwap Token',
          decimals: 18,
          balance: (BigInt(hash) * 1000000000000000000n).toString(),
          balanceFormatted: `${hash}.0000`,
          contractAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
          priceUsd: 2.5,
          valueUsd: hash * 2.5,
        },
      ],
      solana: [],
    };

    return chainTokens[chain] || [];
  }

  private calculateTotalValueUsd(nativeBalance: bigint, chain: ChainType): number {
    const nativePrices: Record<ChainType, number> = {
      ethereum: 2000,
      polygon: 0.8,
      arbitrum: 2000,
      optimism: 2000,
      bsc: 300,
      solana: 100,
    };

    const price = nativePrices[chain] || 0;
    return Number(nativeBalance) / 1e18 * price;
  }

  private simulateGasPrice(chain: ChainType): string {
    const gasPrices: Record<ChainType, bigint> = {
      ethereum: 30000000000n,
      polygon: 100000000000n,
      arbitrum: 1000000000n,
      optimism: 1000000000n,
      bsc: 3000000000n,
      solana: 500000n,
    };

    const basePrice = gasPrices[chain] || 30000000000n;
    const variance = BigInt(Math.floor(Math.random() * 1000000000));
    return (basePrice + variance).toString();
  }

  private simulateGasLimit(transaction: Omit<Transaction, 'transactionId' | 'timestamp'>): string {
    if (transaction.data && transaction.data !== '0x') {
      return (21000n + BigInt(Math.floor(transaction.data.length / 2) * 16)).toString();
    }
    return '21000';
  }

  private calculateGasCostUsd(gasCost: string, chain: ChainType): number {
    const gasPrice = BigInt(gasCost);
    const gasPriceGwei = gasPrice / 1000000000n;
    const nativePrices: Record<ChainType, number> = {
      ethereum: 2000,
      polygon: 0.8,
      arbitrum: 2000,
      optimism: 2000,
      bsc: 300,
      solana: 100,
    };

    const price = nativePrices[chain] || 0;
    return Number(gasPriceGwei) * price / 1e9;
  }

  private simulateContractCall(functionName: string, _parameters: Record<string, unknown>): unknown {
    if (functionName === 'balanceOf') {
      return '1000000000000000000';
    }
    if (functionName === 'ownerOf') {
      return '0x1234567890123456789012345678901234567890';
    }
    if (functionName === 'name') {
      return 'Test NFT';
    }
    if (functionName === 'symbol') {
      return 'TNFT';
    }
    if (functionName === 'totalSupply') {
      return '10000';
    }
    if (functionName === 'getRate') {
      return '1500000000000000000';
    }
    return { success: true };
  }

  private simulateSignature(message: string, address: string): string {
    const dataToSign = `${message}:${address}:${Date.now()}`;
    return '0x' + crypto.createHash('sha256').update(dataToSign).digest('hex');
  }
}

export function createWeb3Service(): Web3BlockchainService {
  return new Web3BlockchainService();
}
