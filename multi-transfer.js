const BigNumber = require("bignumber.js");
const program = require('commander');
const fs = require("fs");
const readlineSync = require("readline-sync");
const JCCExchange = require("jcc_exchange").JCCExchange;
const JingchangWallet = require("jcc_wallet").JingchangWallet;
const config = require("./config");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "钱包地址")
  .option('-P, --password <path>', "keystore密码")
  .option('-c, --currency <path>', "token名称")
  .option('-a, --amount <path>', "数量")
  .option('-m, --memo <path>', "备注")
  .parse(process.argv);


const delay = async (timer) => {
  return new Promise((resolve) => setTimeout(resolve, timer));
};


const multiTransfer = async () => {
  const { address, amount, currency, memo } = program;
  let password = program.password;
  try {
    if (!password) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    console.time("start");
    const datas = new Array(1000).fill("jMyVALwXMQ4k2EJYRVB9qW4UrbCCXVhw7F");
    const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
    const instance = new JingchangWallet(JSON.parse(keystore), true, false);
    const secret = await instance.getSecretWithAddress(password, address);
    // const nodes = await config.getRpcNodes();
    const nodes = config.rpcNodes;
    JCCExchange.init(nodes);
    for(let i = 0; i < datas.length; i++) {
      if(i!== 0) {
        await delay(500);
      }
      let hash = await JCCExchange.transfer(address, secret, amount, memo, datas[i], currency);
      console.log(`第${i + 1}个转账成功: ${hash}`);
    }
    console.timeEnd("start");
  } catch (error) {
    console.log("转账失败: ", error.message);
  }
}

multiTransfer();