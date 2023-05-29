import hre from "hardhat";

async function main() {
  await hre.run("verify:verify", {
    address: process.env.CONTRACT_ADDRESS,
    constructorArguments: [
      "0xFCd6Af872e772eC3ac344dB731E0cd3A74e8546B",
      "0x187816fb96Fda0a36d33e658ce14fb897223C6db",
      "0xFCd6Af872e772eC3ac344dB731E0cd3A74e8546B",
      "0xFCd6Af872e772eC3ac344dB731E0cd3A74e8546B",
      500,
      "Demo Co",
      "DemoCo",
      "https://niftykit-api-dev.herokuapp.com/reveal/clhpow6xj0001mk0fluuivyrq",
      ["0x68c24fc24acf5b51ccf67c01fea706e9e0e110825d4f88d07623f64f32f55d89"],
    ],
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
