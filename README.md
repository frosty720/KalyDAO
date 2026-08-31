# KalyChain DAO

<div align="center">
  <img src="public/kalychain.png" alt="KalyChain DAO Logo" width="120" />
  <h3>A decentralized governance platform for the KalyChain ecosystem</h3>
</div>

## Overview

KalyChain DAO is a decentralized governance application built on the KalyChain blockchain. It enables token holders to participate in on-chain governance through proposals, voting, delegation, and treasury management.

## Features

- **Proposal Management**: Create, view, and search governance proposals
- **Voting System**: Vote on active proposals with FOR, AGAINST, or ABSTAIN options
- **Delegation**: Delegate your voting power to trusted representatives
- **Treasury Management**: Control treasury funds through governance decisions
- **KMT Wrapping**: Wrap native KMT to governance tokens (gKMT) for participation
- **Vote History**: Track voting history for transparency and accountability
- **Markdown Support**: Rich text formatting for proposal descriptions

## Technology Stack

- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Blockchain Interaction**: wagmi, viem, thirdweb in-app wallet (ONE chain: KalyChain 3890)
- **Data Storage**: Supabase (PostgreSQL)
- **Routing**: React Router
- **State Management**: React hooks and context

## Getting Started

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Access to KalyChain network (Testnet or Mainnet)
- Web3 wallet (e.g., MetaMask)

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/KalyCoinProject/KalyDAO.git
   cd KalyDAO
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure environment variables
   ```bash
   cp .env.example .env   # see .env.example — VITE_RPC_URL / VITE_EXPLORER_URL switch hosts on cut day
   ```
   Edit the `.env` file with your specific configuration

4. Start the development server
   ```bash
   npm run dev
   ```
   The application will be available at http://localhost:5173 (or another port if 5173 is in use)

## Deployment

### Build for Production

```bash
npm run build
```

The build artifacts will be stored in the `dist/` directory.

### Deploy to Production

Deploy the contents of the `dist/` directory to your web hosting service of choice.

## Project Structure

```
KalyDAO/
├── public/                 # Static assets
├── src/
│   ├── assets/             # Images and other assets
│   │   ├── blockchain/         # Blockchain configuration and interactions
│   │   │   ├── config/         # Chain and wallet configs
│   │   │   ├── contracts/      # Contract ABIs and addresses
│   │   ├── components/         # React components
│   │   │   ├── governance/     # Governance-related components
│   │   │   ├── layout/         # Layout components (Header, Footer)
│   │   │   ├── proposals/      # Proposal-related components
│   │   │   ├── token/          # Token-related components
│   │   │   ├── ui/             # Reusable UI components
│   │   │   ├── wrap/           # Token wrapping components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utility functions and libraries
│   │   │   ├── supabase.ts     # Supabase client and functions
│   │   ├── App.tsx             # Main app component with routing
│   │   ├── main.tsx            # Entry point
│   ├── .env                    # Environment variables
│   ├── package.json            # Dependencies and scripts
│   ├── tsconfig.json           # TypeScript configuration
│   └── vite.config.ts          # Vite configuration
```

## Key Features in Detail

### Proposal System

Create, browse, and vote on proposals that affect the KalyChain ecosystem. Each proposal includes:
- Title and description with Markdown support
- On-chain execution actions
- Voting period
- Category and status tracking
- Discussion section for community feedback

### Treasury Management

The DAO controls a Treasury Vault that can:
- Send and receive native KMT
- Manage ERC20 tokens
- Execute contract calls through governance
- Implement timelock security for sensitive operations

### Delegation System

Delegate your voting power to trusted community members to:
- Increase governance participation
- Allow technical experts to represent your interests
- Easily manage and track your delegations

### KMT Wrapping

Convert between native KMT and governance KMT (gKMT) tokens:
- 1:1 conversion ratio
- Required for governance participation
- Unwrap at any time to reclaim native KMT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please open an issue on the GitHub repository.

---

<div align="center">
  Built with ❤️ for the KalyChain community
</div>
