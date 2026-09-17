require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, SEPOLIA_PRIVATE_KEY } = process.env;

/** @type {import('hardhat/config').HardhatUserConfig} */
module.exports = {
  solidity: "0.8.30",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(SEPOLIA_RPC_URL && SEPOLIA_PRIVATE_KEY
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: [SEPOLIA_PRIVATE_KEY],
          },
        }
      : {}),
  },
};
