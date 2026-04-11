/**
 * Web3 & Blockchain Service Tests
 */

import { Web3BlockchainService } from '../src/core/web3Blockchain/web3Blockchain';
import { Web3BlockchainManus } from '../src/core/web3Blockchain';
import {
  WalletType,
  NetworkType,
  ChainType,
  TransactionStatus,
  WalletStatus,
  NFTType,
  Wallet,
  Transaction,
  SmartContract,
  NFTMintRequest,
  NFTTransferRequest,
  NFTMetadata,
  WalletPermission,
} from '../src/core/web3Blockchain/types';

describe('Web3BlockchainService', () => {
  let service: Web3BlockchainService;

  beforeEach(() => {
    service = new Web3BlockchainService();
  });

  describe('Wallet Management', () => {
    test('should create a hot wallet', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x1234567890123456789012345678901234567890',
        status: 'active',
        label: 'My Hot Wallet',
        balance: {},
        tokens: [],
        nfts: [],
      });

      expect(wallet.walletId).toBeDefined();
      expect(wallet.type).toBe('hot');
      expect(wallet.chain).toBe('ethereum');
      expect(wallet.network).toBe('mainnet');
      expect(wallet.address).toBe('0x1234567890123456789012345678901234567890');
      expect(wallet.status).toBe('active');
      expect(wallet.label).toBe('My Hot Wallet');
      expect(wallet.createdAt).toBeInstanceOf(Date);
      expect(wallet.updatedAt).toBeInstanceOf(Date);
    });

    test('should create a cold wallet', async () => {
      const wallet = await service.createWallet({
        type: 'cold',
        chain: 'polygon',
        network: 'mainnet',
        address: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      expect(wallet.type).toBe('cold');
      expect(wallet.chain).toBe('polygon');
    });

    test('should create a hardware wallet', async () => {
      const wallet = await service.createWallet({
        type: 'hardware',
        chain: 'arbitrum',
        network: 'mainnet',
        address: '0x9876543210987654321098765432109876543210',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      expect(wallet.type).toBe('hardware');
      expect(wallet.chain).toBe('arbitrum');
    });

    test('should get wallet by ID', async () => {
      const created = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x1111111111111111111111111111111111111111',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const retrieved = await service.getWallet(created.walletId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.walletId).toBe(created.walletId);
      expect(retrieved?.address).toBe(created.address);
    });

    test('should get wallet by address', async () => {
      const address = '0x2222222222222222222222222222222222222222';
      await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address,
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const retrieved = await service.getWalletByAddress(address);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.address.toLowerCase()).toBe(address.toLowerCase());
    });

    test('should return null for non-existent wallet', async () => {
      const retrieved = await service.getWallet('non_existent_id');
      expect(retrieved).toBeNull();
    });

    test('should update wallet status', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x3333333333333333333333333333333333333333',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const updated = await service.updateWallet(wallet.walletId, { status: 'locked' });
      expect(updated.status).toBe('locked');
      expect(updated.updatedAt).toBeInstanceOf(Date);
    });

    test('should delete wallet', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x4444444444444444444444444444444444444444',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      await service.deleteWallet(wallet.walletId);
      const retrieved = await service.getWallet(wallet.walletId);
      expect(retrieved).toBeNull();
    });

    test('should get wallet balance', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x5555555555555555555555555555555555555555',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const balance = await service.getWalletBalance(wallet.walletId);
      expect(balance.address).toBe(wallet.address);
      expect(balance.nativeBalance).toBeDefined();
      expect(balance.nativeBalanceFormatted).toBeDefined();
      expect(balance.lastUpdated).toBeInstanceOf(Date);
    });

    test('should get wallet balance by address for different chains', async () => {
      const address = '0x6666666666666666666666666666666666666666';
      const balance = await service.getWalletBalanceByAddress(address, 'polygon', 'mainnet');

      expect(balance.address).toBe(address);
      expect(balance.chain).toBe('polygon');
      expect(balance.network).toBe('mainnet');
      expect(balance.nativeBalance).toBeDefined();
    });
  });

  describe('Transaction Management', () => {
    test('should create a transaction', async () => {
      const tx = await service.createTransaction({
        hash: '0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      expect(tx.transactionId).toBeDefined();
      expect(tx.hash).toBe('0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1');
      expect(tx.status).toBe('pending');
      expect(tx.timestamp).toBeInstanceOf(Date);
    });

    test('should get transaction by ID', async () => {
      const created = await service.createTransaction({
        hash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      const retrieved = await service.getTransaction(created.transactionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.transactionId).toBe(created.transactionId);
    });

    test('should get transaction by hash', async () => {
      const hash = '0x2222222222222222222222222222222222222222222222222222222222222222';
      await service.createTransaction({
        hash,
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      const retrieved = await service.getTransactionByHash(hash);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.hash.toLowerCase()).toBe(hash.toLowerCase());
    });

    test('should update transaction status to confirmed', async () => {
      const tx = await service.createTransaction({
        hash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      const receipt = {
        transactionHash: tx.hash,
        blockNumber: 12345678,
        blockHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
        cumulativeGasUsed: '21000',
        gasUsed: '21000',
        status: 1,
        logs: [],
        logsBloom: '0x',
      };

      const updated = await service.updateTransactionStatus(tx.transactionId, 'confirmed', receipt);
      expect(updated.status).toBe('confirmed');
      expect(updated.confirmedAt).toBeInstanceOf(Date);
      expect(updated.blockNumber).toBe(12345678);
    });

    test('should sign transaction', async () => {
      const tx = await service.createTransaction({
        hash: '0x5555555555555555555555555555555555555555555555555555555555555555',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      const signed = await service.signTransaction(tx.transactionId, '0xsignature');
      expect(signed.status).toBe('confirmed');
      expect(signed.confirmedAt).toBeInstanceOf(Date);
    });

    test('should cancel pending transaction', async () => {
      const tx = await service.createTransaction({
        hash: '0x6666666666666666666666666666666666666666666666666666666666666666',
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
        value: '1000000000000000000',
        gasPrice: '30000000000',
        gasLimit: '21000',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      const cancelled = await service.cancelTransaction(tx.transactionId);
      expect(cancelled.status).toBe('cancelled');
    });

    test('should get transactions by wallet with pagination', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x7777777777777777777777777777777777777777',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      for (let i = 0; i < 5; i++) {
        await service.createTransaction({
          hash: `0x${i.toString().padStart(64, '0')}`,
          from: wallet.address,
          to: '0x2222222222222222222222222222222222222222',
          value: '1000000000000000000',
          gasPrice: '30000000000',
          gasLimit: '21000',
          nonce: i,
          status: 'confirmed',
          chain: 'ethereum',
          network: 'mainnet',
        });
      }

      const page = await service.getTransactionsByWallet(wallet.walletId, { limit: 3 });
      expect(page.transactions.length).toBe(3);
      expect(page.hasMore).toBe(true);
      expect(page.totalCount).toBe(5);
    });
  });

  describe('Smart Contract Management', () => {
    test('should deploy a smart contract', async () => {
      const contract = await service.deployContract({
        name: 'TestNFT',
        address: '0x8888888888888888888888888888888888888888',
        chain: 'ethereum',
        network: 'mainnet',
        abi: {
          functions: [
            {
              name: 'mint',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [{ name: 'to', type: 'address' }],
              outputs: [{ name: 'tokenId', type: 'uint256' }],
            },
          ],
          events: [
            {
              name: 'Transfer',
              type: 'event',
              inputs: [
                { name: 'from', type: 'address', indexed: true },
                { name: 'to', type: 'address', indexed: true },
                { name: 'tokenId', type: 'uint256', indexed: false },
              ],
            },
          ],
        },
      });

      expect(contract.contractId).toBeDefined();
      expect(contract.name).toBe('TestNFT');
      expect(contract.deployedAt).toBeInstanceOf(Date);
    });

    test('should get contract by ID', async () => {
      const created = await service.deployContract({
        name: 'TestToken',
        address: '0x9999999999999999999999999999999999999999',
        chain: 'polygon',
        network: 'mainnet',
        abi: { functions: [], events: [] },
      });

      const retrieved = await service.getContract(created.contractId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.contractId).toBe(created.contractId);
    });

    test('should get contract by address', async () => {
      const address = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      await service.deployContract({
        name: 'TestDAO',
        address,
        chain: 'arbitrum',
        network: 'mainnet',
        abi: { functions: [], events: [] },
      });

      const retrieved = await service.getContractByAddress(address, 'arbitrum');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.address.toLowerCase()).toBe(address.toLowerCase());
    });

    test('should interact with contract (read operation)', async () => {
      const contract = await service.deployContract({
        name: 'TestNFT',
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        chain: 'ethereum',
        network: 'mainnet',
        abi: {
          functions: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'owner', type: 'address' }],
              outputs: [{ name: 'balance', type: 'uint256' }],
            },
          ],
          events: [],
        },
      });

      const result = await service.interactWithContract({
        contractId: contract.contractId,
        functionName: 'balanceOf',
        type: 'read',
        parameters: { owner: '0x1234567890123456789012345678901234567890' },
      });

      expect(result.interactionId).toBeDefined();
      expect(result.status).toBe('success');
      expect(result.result).toBeDefined();
    });

    test('should interact with contract (write operation)', async () => {
      const contract = await service.deployContract({
        name: 'TestNFT',
        address: '0xcccccccccccccccccccccccccccccccccccccccc',
        chain: 'ethereum',
        network: 'mainnet',
        abi: {
          functions: [
            {
              name: 'mint',
              type: 'function',
              stateMutability: 'nonpayable',
              inputs: [{ name: 'to', type: 'address' }],
              outputs: [{ name: 'tokenId', type: 'uint256' }],
            },
          ],
          events: [],
        },
      });

      const result = await service.interactWithContract({
        contractId: contract.contractId,
        functionName: 'mint',
        type: 'write',
        parameters: { to: '0x1234567890123456789012345678901234567890' },
      });

      expect(result.interactionId).toBeDefined();
      expect(result.status).toBe('success');
    });
  });

  describe('NFT Operations', () => {
    test('should mint ERC721 NFT', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0xdddddddddddddddddddddddddddddddddddddddd',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const mintRequest: NFTMintRequest = {
        contractAddress: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        to: wallet.address,
        uri: 'ipfs://QmXxx123',
        metadata: {
          name: 'Test NFT #1',
          description: 'A test NFT',
          image: 'ipfs://QmImage123',
          attributes: [
            { traitType: 'Background', value: 'Blue' },
            { traitType: 'Level', value: 5 },
          ],
        },
      };

      const result = await service.mintNFT(mintRequest, wallet.walletId);

      expect(result.mintId).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.tokenId).toBeDefined();
      expect(result.contractAddress).toBe(mintRequest.contractAddress);
      expect(result.owner).toBe(wallet.address);
      expect(result.tokenUri).toBe(mintRequest.uri);
      expect(result.metadata.name).toBe('Test NFT #1');
    });

    test('should mint ERC1155 NFT with quantity', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'polygon',
        network: 'mainnet',
        address: '0xffffffffffffffffffffffffffffffffffffffff',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const mintRequest: NFTMintRequest = {
        contractAddress: '0x0123456789abcdef0123456789abcdef01234567',
        to: wallet.address,
        uri: 'ipfs://QmYyy456',
        quantity: 100,
        royalties: 250,
        metadata: {
          name: 'Gaming Item - Gold Sword',
          description: 'A powerful sword for gaming',
          image: 'ipfs://QmSword789',
          attributes: [
            { traitType: 'Damage', value: 150 },
            { traitType: 'Rarity', value: 'Legendary' },
          ],
        },
      };

      const result = await service.mintNFT(mintRequest, wallet.walletId);

      expect(result.mintId).toBeDefined();
      expect(result.metadata.name).toBe('Gaming Item - Gold Sword');
    });

    test('should transfer NFT', async () => {
      const wallet1 = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x1111111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const wallet2 = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x2222222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const transferRequest: NFTTransferRequest = {
        contractAddress: '0x3333333333cccccccccccccccccccccccccccccccc',
        from: wallet1.address,
        to: wallet2.address,
        tokenId: '12345',
        quantity: 1,
      };

      const result = await service.transferNFT(transferRequest, wallet1.walletId);

      expect(result.transferId).toBeDefined();
      expect(result.transactionId).toBeDefined();
      expect(result.tokenId).toBe('12345');
      expect(result.from).toBe(wallet1.address);
      expect(result.to).toBe(wallet2.address);
      expect(result.quantity).toBe('1');
    });

    test('should get NFT metadata', async () => {
      const contract = await service.deployContract({
        name: 'TestNFT',
        address: '0x4444444444dddddddddddddddddddddddddddddddd',
        chain: 'ethereum',
        network: 'mainnet',
        abi: { functions: [], events: [] },
      });

      const metadata = await service.getNFTMetadata(contract.address, '999', 'ethereum');

      expect(metadata).not.toBeNull();
      expect(metadata?.name).toBe('NFT #999');
      expect(metadata?.description).toContain(contract.address);
    });
  });

  describe('Wallet Connection', () => {
    test('should connect wallet to dApp', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x5555555555eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const connection = await service.connectWallet({
        walletId: wallet.walletId,
        userId: 'user_123',
        dappName: 'Uniswap',
        dappUrl: 'https://app.uniswap.org',
        chain: 'ethereum',
        network: 'mainnet',
        permissions: [
          { permission: 'read' },
          { permission: 'write' },
          { permission: 'sign' },
        ],
      });

      expect(connection.connectionId).toBeDefined();
      expect(connection.walletId).toBe(wallet.walletId);
      expect(connection.userId).toBe('user_123');
      expect(connection.dappName).toBe('Uniswap');
      expect(connection.isActive).toBe(true);
      expect(connection.connectedAt).toBeInstanceOf(Date);
    });

    test('should disconnect wallet from dApp', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x6666666666ffffffffffffffffffffffffffffffff',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const connection = await service.connectWallet({
        walletId: wallet.walletId,
        userId: 'user_456',
        dappName: 'OpenSea',
        chain: 'ethereum',
        network: 'mainnet',
        permissions: [{ permission: 'read' }],
      });

      await service.disconnectWallet(connection.connectionId);

      const retrieved = await service.getWalletConnections(wallet.walletId);
      expect(retrieved.length).toBe(0);
    });

    test('should get active connections for user', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0x7777777777aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      await service.connectWallet({
        walletId: wallet.walletId,
        userId: 'user_789',
        dappName: 'Aave',
        chain: 'ethereum',
        network: 'mainnet',
        permissions: [{ permission: 'read' }],
      });

      const connections = await service.getActiveConnections('user_789');
      expect(connections.length).toBe(1);
      expect(connections[0].dappName).toBe('Aave');
    });
  });

  describe('Gas Estimation', () => {
    test('should estimate gas for transaction', async () => {
      const estimate = await service.estimateGas({
        hash: '',
        from: '0x8888888888bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        to: '0x9999999999cccccccccccccccccccccccccccccccc',
        value: '1000000000000000000',
        gasPrice: '0',
        gasLimit: '0',
        nonce: 0,
        status: 'pending',
        chain: 'ethereum',
        network: 'mainnet',
      });

      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.gasLimit).toBeDefined();
      expect(estimate.gasEstimate).toBeDefined();
      expect(estimate.cost).toBeDefined();
      expect(estimate.costFormatted).toBeDefined();
      expect(estimate.estimatedTimeMs).toBeGreaterThanOrEqual(0);
    });

    test('should get current gas price for polygon', async () => {
      const estimate = await service.getCurrentGasPrice('polygon', 'mainnet');

      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.gasLimit).toBe('21000');
      expect(estimate.cost).toBeDefined();
      expect(estimate.costFormatted).toBeDefined();
    });

    test('should get current gas price for BSC', async () => {
      const estimate = await service.getCurrentGasPrice('bsc', 'mainnet');

      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.gasLimit).toBe('21000');
    });
  });

  describe('Message Signing', () => {
    test('should sign message', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0xaaaaaaaaaaaaaaaaaaaa0aaaaaaaaaaaaaaaaaaaa0',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const signature = await service.signMessage(wallet.walletId, 'Hello, Web3!');

      expect(signature.signatureId).toBeDefined();
      expect(signature.walletId).toBe(wallet.walletId);
      expect(signature.message).toBe('Hello, Web3!');
      expect(signature.signature).toBeDefined();
      expect(signature.signature.startsWith('0x')).toBe(true);
      expect(signature.signedAt).toBeInstanceOf(Date);
      expect(signature.verification?.isValid).toBe(true);
    });

    test('should verify signature', async () => {
      const wallet = await service.createWallet({
        type: 'hot',
        chain: 'ethereum',
        network: 'mainnet',
        address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        status: 'active',
        balance: {},
        tokens: [],
        nfts: [],
      });

      const created = await service.signMessage(wallet.walletId, 'Test message for verification');
      const verified = await service.verifySignature(created.signatureId);

      expect(verified.signatureId).toBe(created.signatureId);
      expect(verified.verification?.isValid).toBe(true);
      expect(verified.verification?.verifiedAt).toBeInstanceOf(Date);
    });
  });

  describe('Chain Configuration', () => {
    test('should get Ethereum mainnet config', () => {
      const config = service.getChainConfig('ethereum', 'mainnet');

      expect(config.chain).toBe('ethereum');
      expect(config.network).toBe('mainnet');
      expect(config.chainId).toBe(1);
      expect(config.name).toBe('Ethereum Mainnet');
      expect(config.nativeCurrency.symbol).toBe('ETH');
      expect(config.nativeCurrency.decimals).toBe(18);
      expect(config.isSupported).toBe(true);
    });

    test('should get Polygon testnet config', () => {
      const config = service.getChainConfig('polygon', 'testnet');

      expect(config.chain).toBe('polygon');
      expect(config.network).toBe('testnet');
      expect(config.chainId).toBe(80001);
      expect(config.name).toBe('Mumbai Testnet');
      expect(config.nativeCurrency.symbol).toBe('MATIC');
    });

    test('should get Arbitrum config', () => {
      const config = service.getChainConfig('arbitrum', 'mainnet');

      expect(config.chain).toBe('arbitrum');
      expect(config.chainId).toBe(42161);
      expect(config.blockExplorerUrl).toContain('arbiscan.io');
    });

    test('should get all supported chains', () => {
      const chains = service.getSupportedChains();

      expect(chains.length).toBeGreaterThan(0);
      expect(chains.every((c) => c.isSupported)).toBe(true);
      
      const ethereumChains = chains.filter((c) => c.chain === 'ethereum');
      expect(ethereumChains.length).toBe(3);
    });

    test('should return default config for unknown chain', () => {
      const config = service.getChainConfig('ethereum' as ChainType, 'testnet' as NetworkType);
      expect(config).toBeDefined();
    });
  });
});

describe('Web3BlockchainManus', () => {
  let manus: Web3BlockchainManus;

  beforeEach(() => {
    manus = new Web3BlockchainManus();
  });

  describe('High-level Operations', () => {
    test('should create wallet via Manus class', async () => {
      const wallet = await manus.createWallet('hot', 'ethereum', 'mainnet', '0x1234567890abcdef1234567890abcdef12345678', 'user_001', 'My Wallet');

      expect(wallet.walletId).toBeDefined();
      expect(wallet.type).toBe('hot');
      expect(wallet.label).toBe('My Wallet');
    });

    test('should send transaction via Manus class', async () => {
      const tx = await manus.sendTransaction(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        '1000000000000000000',
        'ethereum',
        'mainnet'
      );

      expect(tx.transactionId).toBeDefined();
      expect(tx.status).toBe('pending');
    });

    test('should get supported chains', () => {
      const chains = manus.getSupportedChains();
      expect(chains.length).toBeGreaterThan(0);
    });

    test('should estimate gas', async () => {
      const estimate = await manus.estimateTransactionGas(
        '0xcccccccccccccccccccccccccccccccccccccccc',
        '0xdddddddddddddddddddddddddddddddddddddddd',
        '500000000000000000',
        'ethereum',
        'mainnet'
      );

      expect(estimate.gasPrice).toBeDefined();
      expect(estimate.gasLimit).toBeDefined();
    });

    test('should connect wallet to dApp', async () => {
      const wallet = await manus.createWallet('hot', 'ethereum', 'mainnet', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'user_002');

      const connection = await manus.connectWallet(wallet.walletId, 'user_002', 'OpenSea', 'ethereum', 'mainnet');

      expect(connection.connectionId).toBeDefined();
      expect(connection.dappName).toBe('OpenSea');
    });

    test('should sign and verify message', async () => {
      const wallet = await manus.createWallet('hot', 'ethereum', 'mainnet', '0xffffffffffffffffffffffffffffffffffffffff', 'user_003');

      const signature = await manus.signMessage(wallet.walletId, 'Authenticate with Manus');
      expect(signature.signature).toBeDefined();

      const verified = await manus.verifySignature(signature.signatureId);
      expect(verified.verification?.isValid).toBe(true);
    });
  });
});
