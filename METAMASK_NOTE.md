# MetaMask and Ethereum Support

> [!NOTE]
> **MetaMask is an Ethereum (EVM) wallet and does not natively support Solana.**
> 
> The Fantasy Forecast League is built on **Solana**, which uses a different blockchain architecture and wallet standard. The Anchor smart contract, Solana Web3.js integration, and on-chain logic are all Solana-specific.
>
> **Supported Solana Wallets:**
> - Phantom (most popular)
> - Solflare
> - Coinbase Wallet (Solana support)
> - Trust Wallet (Solana support)
> - Ledger (hardware wallet)
>
> **To add MetaMask support, you would need to:**
> 1. Rewrite the entire smart contract in Solidity for Ethereum/EVM chains
> 2. Replace Anchor with Hardhat or Foundry
> 3. Replace Solana Web3.js with Ethers.js or Viem
> 4. Use a different oracle solution (Polymarket is on Polygon/Ethereum)
>
> **Alternative: Multi-chain Support**
> You could build parallel implementations on both Solana (current) and Ethereum, but this would be a major undertaking requiring separate contracts, separate frontends, and separate liquidity pools.
