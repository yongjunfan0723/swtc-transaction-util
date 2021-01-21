const sign = require("jcc_exchange").sign;
const BigNumber = require("bignumber.js");
const program = require('commander');
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const readlineSync = require("readline-sync");
const JCCExchange = require("jcc_exchange").JCCExchange;
// const { NodeRpcFactory } = require("jcc_rpc");
const { ExplorerFactory } = require("jcc_rpc");
const JingchangWallet = require("jcc_wallet").JingchangWallet;
const jtWallet = require("jcc_wallet").jtWallet;
const Tx = require("jcc_exchange").Tx;
const isValidCurrency = require("@swtc/common").isValidCurrency;
const config = require("./config");

program
  .usage('[options] <file ...>')
  .option('-A, --address <path>', "钱包地址")
  .option('-P, --password <path>', "keystore密码")
  .option('-t, --type <path>', "文件类型")
  // .option('-c, --currency <path>', "token名称")
  // .option('-a, --amount <path>', "数量")
  // .option('-t, --to <path>', "转入钱包地址")
  // .option('-m, --memo <path>', "备注")
  .parse(process.argv);


const delay = async (timer) => {
  return new Promise((resolve) => setTimeout(resolve, timer));
};

const isObject = (obj) => {
  return Object.prototype.toString.call(obj) === "[object Object]";
};

const isEmptyObject = (obj) => {
  if (JSON.stringify(obj) === "{}") {
    return true
  }
  return false
}

const parseCsv = () => {
  return new Promise((resolve, reject) => {
    try {
      const  filePath = path.join(__dirname, './batch_test/test.csv');
      // Read CSV
      let readFile = fs.readFileSync(filePath, { encoding: 'utf-8' }, (err) => {
        console.log("read csv file error:", err.message);
        reject(error);
      });
      
      // Split on row
      readFile = readFile.split("\n");
      
      // Get first row for column headers
      const headers = readFile.shift().split(",");
      
      const json = [];
      let k = 0;
      for(; k < readFile.length; k++) {
        const item = readFile[k];
         // Loop through each row
         let tmp = {};
         let row = item.split(",");
         for(let i = 0; i < headers.length; i++) {
           if(!/^[\u4e00-\u9fa5]+$/i.test(headers[i])) {
             break;
             }
            tmp[headers[i]] = row[i];
         }
         // Add object to list
         if(!isEmptyObject(tmp)) {
           json.push(tmp);
         }
      }
      resolve(json);
    } catch(err) {
      console.log("解析csv文件过程中发生的错误:", err);
      reject(error);
    }
});
}

const judgeDupAmount = (list) => {
  const originToList = list;
  const noDupArr = [...new Set(originToList)];
  let dupArray = [];
  console.log("origin toList Length:", originToList.length);
  console.log("noDupArr Length:", noDupArr.length);
  let count = 0;
  let obj = {}; //最终返回的数据
  noDupArr.forEach(i => {
    count = 0;
    originToList.forEach(j => {
        if(i===j) count++;
    })
    obj[i] = count;
    })
   for(let i in obj) {
      if(obj[i] > 1) {
        console.log(i + ':' + obj[i]);
        dupArray.push(obj[i]);
      }
   }
   console.log("有多少重复的:", dupArray.length);
}

const transfer = async () => {
  const { address, type } = program;
  let password = program.password;
  try {
    if(!jtWallet.isValidAddress(address.trim())) {
      console.log(`${address} 不合法`);
      return;
    }
    if (!password) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    console.time("start");
    const explorerInst = ExplorerFactory.init(config.explorerNodes);
    const list = [];
    const tokens = [];
    let parseData;
    if(type === "0") {
      const isexistExcel = fs.existsSync("./batch_test/testTransfer.xlsx");
      if(!isexistExcel) {
        console.log("请导入xlsx文件!");
        return;
      }
      const file = fs.readFileSync("./batch_test/testTransfer.xlsx", { encoding: "binary" });
      const workBook = XLSX.read(file, { type: "binary" });
      const worksheet = workBook.Sheets[workBook.SheetNames[0]];
      parseData = XLSX.utils.sheet_to_json(worksheet);
    } else {
      const isexistCsv = fs.existsSync("./batch_test/test.csv");
       if(!isexistCsv) {
         console.log("请导入csv文件!");
         return;
       }
       parseData = await parseCsv();
    }
    if(parseData.length === 0) {
      console.log("解析出来的数据有误,请检查后重试!");
      return;
    }
    const searchedAddress = [];
    const notActiveAddressArray = [];
    // const addressList = [];
    for(let i = 0; i < parseData.length; i++) {
      let item = parseData[i];
        let txData = {
          to: item["地址"]? item["地址"].trim() : "",
          token: item["币种"]? item["币种"].trim().toUpperCase() : "",
          amount: item["数量"] || "",
          memo: item["转账备注"] || "",
          // status: 0,
        };
        //  addressList.push(txData.to);
        if (jtWallet.isValidAddress(txData.to) && !new BigNumber(txData.amount).isNaN() && new BigNumber(txData.amount).gt(0) && isValidCurrency(txData.token)) {
          if(txData.to === address) {
            console.log(`转入地址: ${txData.to} 和 转出地址: ${address} 是同一地址`);
            continue;
          }
          const existToken = tokens.find((token) => token === txData.token);
          const findAddress = searchedAddress.find((address) => address === txData.to);
          const notActive = notActiveAddressArray.find((item) => item === txData.to);
          if(notActive) {
            continue;
          }
           if(!findAddress) {
            const toBalance = await explorerInst.getBalances(txData.to, txData.to);
            if(toBalance.code === "2004") {
              console.log(`${txData.to} 未激活`);
              notActiveAddressArray.push(txData.to);
              continue;
            }
           if(toBalance.result) {
            searchedAddress.push(txData.to);
            txData.amount = new BigNumber(txData.amount).toString(10);
            list.push(txData);
            if(!existToken) {
              tokens.push(txData.token);
            }
           }
          } else {
            txData.amount = new BigNumber(txData.amount).toString(10);
            list.push(txData);
            if(!existToken) {
              tokens.push(txData.token);
            }
          }
      } else {
        console.log("不合法的数据:", txData);
      }
    }
  if(list.length === 0) {
      return;
  }
  // judgeDupAmount(addressList);
  console.log("解析出来的合法数据:", list, "共多少条:", list.length);
  const balanceRes = await explorerInst.getBalances(address, address);
  if (!balanceRes.result) {
    console.log("获取转出地址资产失败:", balanceRes.msg);
    if(balanceRes.code === "2004") {
      console.log(`转出地址${address} 未激活`);
    }
    return;
  }
  const isExistSwt = tokens.find((el) => el === "SWT");
  const data = balanceRes.data;
  const balance = {};
  if(!isExistSwt) {
    const swtc = data["SWTC"];
    available = new BigNumber(swtc.value).minus(swtc.frozen);
    balance["SWT"] = { available };
  }
  for (const token of tokens) {
    let key;
    if (token.toUpperCase() === "SWT") {
      key = "SWTC";
    } else {
      key = `${token.toUpperCase()}_jGa9J9TkqtBcUoHe2zqhVFFbgUVED6o9or`;
    }
    const b = data[key];
    let available = new BigNumber(0);
    if (b) {
      available = new BigNumber(b.value).minus(b.frozen);
    }
    balance[token] = {
      available
    };
  }
    const transferList = [];
    const nodes = config.rpcNodes;
    JCCExchange.init(nodes, 0);
    let sequence = await JCCExchange.getSequence(address);
    for(let i = 0; i < list.length; i++) {
      if(new BigNumber(list[i].amount).gt(balance[list[i].token].available)){
        console.log(`${list[i].token} 的资产${balance[list[i].token].available.toString(10)} 小于实际要转的数量${new BigNumber(list[i].amount).toString(10)}`);
        continue;
      }
      const tx = Tx.serializePayment( 
        address,
        list[i].amount,
        list[i].to,
        list[i].token,
        isObject(list[i].memo) ? JSON.stringify(list[i].memo) : list[i].memo);
        const copyTx = Object.assign({}, tx);
        if(i === 0) {
          copyTx.Sequence = sequence;
        } else {
          sequence = sequence + 1;
          copyTx.Sequence = sequence;
        }
        transferList.push(copyTx);
    }
    console.log("组装成的TX数组:", transferList);
    console.log("要发送多少笔TX:", transferList.length);
    if(transferList.length === 0){
      return;
    }
    const gasFee = new BigNumber(transferList.length).times(0.00001);
    if(new BigNumber(balance["SWT"].available).lt(gasFee)) {
      console.log("gas费不足");
      return;
    }
    const keystore = fs.readFileSync("./keystore/wallet.json", { encoding: "utf-8" });
    const instance = new JingchangWallet(JSON.parse(keystore), true, false);
    const secret = await instance.getSecretWithAddress(password, address);
    const signList = [];
    for(let tx of transferList) {
      try {
        const signData = sign(tx, secret, "jingtum", true);
        signList.push(signData);
      } catch(err) {
        console.log("签名失败:", err.message);
      }
    }
    const hashList = [];
    const failSendList = [];
    for(let item of signList) {
      let retry = 0;
      let hash;
      while(!hash) {
        if (retry === 3) {
          failSendList.push(item);
          break;
        }
        try {
          hash = await JCCExchange.sendRawTransaction(item.blob);
          hashList.push(hash);
        } catch (error) {
          let errorAmount, errorCurrency;
          const Amount = item.tx.Amount;
          if(typeof Amount === "string") {
              errorAmount = Amount;
              errorCurrency = "SWT";
          } else {
              errorAmount = Amount.value;
              errorCurrency = Amount.currency;
          }
          if(error.message !== "Missing/inapplicable prior transaction." && error.message !== "This sequence number has already past.") {
            console.log("不是因为Sequence导致的失败");
            console.log(`这条to: ${item.tx.Destination}, token: ${errorCurrency} , amount: ${errorAmount}, sequence: ${item.tx.Sequence}  失败: ${error.message}`);
            failSendList.push(item);
            break;
          }
          console.log(`这条to: ${item.tx.Destination}, token: ${errorCurrency} , amount: ${errorAmount}, sequence: ${item.tx.Sequence}  失败: ${error.message}`);
          retry = retry + 1;
        }
      }
    }
    console.log("转账失败的数组:", failSendList, "失败多少条:", failSendList.length);
    if(failSendList.length > 0) {
      const filterArr = failSendList.map(item => {
        return {
          地址: item.tx.Destination,
          币种: typeof item.tx.Amount === "string" ? "SWT" : item.tx.Amount.currency,
          数量: typeof item.tx.Amount === "string" ?  item.tx.Amount : item.tx.Amount.value,
          转账备注: item.tx.Memos[0].Memo.MemoData ? item.tx.Memos[0].Memo.MemoData : ""
        }
        });
        const sheet = XLSX.utils.json_to_sheet(filterArr);
        const newWorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkBook, sheet, "sheet1");
        XLSX.writeFile(newWorkBook, "testTransfer.xlsx");
    }
    console.log("转账hash数组:", hashList);
    if(hashList.length === 0) {
      console.log("转账全部失败,请重新转账!");
      return;
    }
    if(transferList.length === hashList.length) {
      console.log("转账全部完成");
    }
    let successCount = 0;
    for(let hash of hashList) {
      while(true) {
        const res = await explorerInst.orderDetail(Date.now(), hash);
        if(res.result) {
          if(res.data.succ === "tesSUCCESS") {
           successCount++;
          }
          break;
        } else {
          await delay(1000 *3);
        }
       }
     }
   console.log("转账通过查询hash成功多少条:", successCount);
   console.timeEnd("start");
  } catch (error) {
    console.log("error:", error.message);
  }
}

transfer();