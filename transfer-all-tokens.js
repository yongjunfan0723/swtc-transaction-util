const BigNumber = require("bignumber.js");
const program = require('commander');
const fs = require("fs");
const readlineSync = require("readline-sync");
const JCCExchange = require("jcc_exchange").JCCExchange;
const JingchangWallet = require("jcc_wallet").JingchangWallet;
const { ExplorerFactory } = require("jcc_rpc");
const config = require("./config");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "钱包地址")
  .option('-P, --password <path>', "keystore密码")
  .option('-t, --to <path>', "转入钱包地址")
  .parse(process.argv);


const getBalance = async (address) => {
  const inst = ExplorerFactory.init(["https://explorer.jccdex.cn"]);
  const res = await inst.getBalances(Date.now(), address);
  if (!res.result) {
    throw new Error(res.msg);
  }
  return objectConvertToArr(res.data);
}

const objectConvertToArr = (data) => {
  let arr = [];
  for (const key in data) {
    let obj = data[key];
    if (key === "_id" || key === "feeflag") {
      continue;
    }
    const isZero = new BigNumber(obj.value).isZero();
    if (isZero) {
      continue;
    }
    let [currency] = key.split("_");
    if (currency.toLowerCase() === "swtc") {
      currency = "SWT";
    }
    const object = {
      currency: currency,
      value: obj.value,
      freezed: obj.frozen
    }
    arr.push(object);
  }
  return arr;
}

const transfer = (address, secret, amount, to, token, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    setTimeout(async () => {
      try {
        const hash = await JCCExchange.transfer(address, secret, amount, "", to, token);
        resolve(hash);
      } catch (error) {
        reject(error);
      }
    }, timeout)
  })
}

const transferTokens = async () => {
  const { address, to } = program;
  let password = program.password;
  if (!password) {
    password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
  }
  const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
  const instance = new JingchangWallet(JSON.parse(keystore), true, false);
  const secret = await instance.getSecretWithAddress(password, address);
  const nodes = await config.getRpcNodes();
  JCCExchange.init(nodes);

  while (true) {
    try {
      const balances = await getBalance(address);
      const swtBalance = balances.find((balance) => balance.currency === "SWT");
      const filterBalances = balances.filter((balance) => balance.currency !== "SWT" && new BigNumber(balance.value).minus(balance.freezed).gt(0));
      const miniGasLimit = 0.00001;
      if (filterBalances.length === 0) {
        console.log("swt余额: ", swtBalance);
        // swt余额存在，且大于gas费0.00001
        const available = new BigNumber(swtBalance.value).minus(swtBalance.freezed)
        if (available.gt(miniGasLimit)) {
          try {
            // 以前因为jcc_jingtum_lib里BigNumber的问题，转账数量需要保留(控制)15位有效数字的精度  .precision(15, 1)
            // 具体错误: BigNumber Error: new BigNumber() number type has more than 15 significant digits: 1.000999999999988 (Amount)
            // amount="1.0009999999999881“时, Error: Number can only safely store up to 54 bits (Amount)
            const amount = available.minus(miniGasLimit).precision(16, 1).toString(10);
            await transfer(address, secret, amount, to, "swt");
            console.log("转账成功:", swtBalance.currency);
            break;
          } catch (error) {
            console.log("只有SWT时, SWT转账失败: ", error);
            break;
          }
        } else {
          // 小于则跳出循环
          break;
        }
      } else {
        const gas = new BigNumber(miniGasLimit).multipliedBy(filterBalances.length).plus(miniGasLimit).toString(10);
        // 如果swt余额小于将要消耗的gas
        if (new BigNumber(swtBalance.value).minus(swtBalance.freezed).lt(gas)) {
          break;
        }
        let hasFailed = false;
        let count = 0;
        for (const balance of filterBalances) {
          try {
            const available = new BigNumber(balance.value).minus(balance.freezed);
            const amount = available.precision(16, 1).toString(10);
            await transfer(address, secret, amount, to, balance.currency);
            console.log("转账成功:", balance.currency);
            count++;
          } catch (error) {
            console.log(`${balance.currency}转账失败: `, error);
            hasFailed = true;
          }
        }
        if (count === 0) {
          break;
        }
        if (filterBalances.length === count) {
          try {
            const available = new BigNumber(swtBalance.value).minus(swtBalance.freezed).minus(gas);
            const amount = available.precision(16, 1).toString(10);
            await transfer(address, secret, amount, to, "swt");
            console.log("转账成功:", swtBalance.currency);
          } catch (error) {
            console.log(`${swtBalance.currency}转账失败: `, error);
            hasFailed = true;
            break;
          }
        }
        if (!hasFailed) {
          // 如果没有失败case, 跳出循环
          break;
        }
      }
    } catch (error) {
      // 获取余额失败，跳出循环, 防止钱包未激活形成死循环
      console.log(error)
      break
    }
  }
}

transferTokens()