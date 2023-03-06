import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-deploy";
import "@openzeppelin/hardhat-upgrades";
import "hardhat-contract-sizer";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.18",
    settings: {
      optimizer: {
        enabled: true,
      },
    },
  },
  contractSizer: {
    runOnCompile: true,
  },
  networks: {
    mainnet: {
      url: "https://eth-mainnet.g.alchemy.com/v2/zmq_AgdbzMv1Skmd0X9RQBxaVZ8-zlEp",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    goerli: {
      url: "https://eth-goerli.g.alchemy.com/v2/_akMAjO2ZK91Tj0dhis4ztg92OQDuLdH",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    matic: {
      url: "https://polygon-mainnet.g.alchemy.com/v2/ckgNaps_vXbvXxFYNvszn4Ip_02k7SEs",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    mumbai: {
      url: "https://polygon-mumbai.infura.io/v3/f1a65c98a181483ba561f8a15acf6be5",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    optimism: {
      url: "https://opt-mainnet.g.alchemy.com/v2/tv6ueznDIB8SUzlf0BC9t-ivZq3nCXCm",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    ogor: {
      url: "https://opt-goerli.g.alchemy.com/v2/q5q7MJOEF1Sq3IsTMi7SHew624rcP-cY",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    arbitrum: {
      url: "https://arb-mainnet.g.alchemy.com/v2/UTo_9CGRBm6xrgBEkRkw6QJHY09hzGoB",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
    agor: {
      url: "https://arb-goerli.g.alchemy.com/v2/K_kUP-i_aujVzmi_VJSMSzSCfzU9qEHD",
      accounts: process.env.ACCOUNT ? [process.env.ACCOUNT] : undefined,
    },
  },
  etherscan: {
    apiKey: {
      mainnet: "R9ZD9F2KVNQ4ZQSG5Q4QV424YJKICZXMVJ",
      goerli: "R9ZD9F2KVNQ4ZQSG5Q4QV424YJKICZXMVJ",
      polygon: "P96ZQMC8ITFESB2BKJFIWNY5875IHNITHS",
      polygonMumbai: "P96ZQMC8ITFESB2BKJFIWNY5875IHNITHS",
      optimisticEthereum: "MNUQ5YNPERZQJY799A2MATQCJJUI5NCKAP",
      optimisticGoerli: "MNUQ5YNPERZQJY799A2MATQCJJUI5NCKAP",
      arbitrumOne: "F77Y269K4K8YBGCMSCWVAS36WJ9WCD8879",
      arbitrumGoerli: "F77Y269K4K8YBGCMSCWVAS36WJ9WCD8879",
    },
  },
};

export default config;
