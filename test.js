const { JingchangWallet, ethWallet } = require("jcc_wallet");
const program = require('commander');
const readlineSync = require("readline-sync");

program
  .description('test create jcWallet')
  .option('-p, --password <path>', "密码")
  .parse(process.argv);

const test = async () => {
  try {
    let password = program.password;
    if (isEmptyString(password)) {
      password = readlineSync.question("Please Enter Password:", { hideEchoBack: true });
    }
    const jcWallet = await JingchangWallet.generate(password);
    if (JingchangWallet.isValid(jcWallet)) {
      const etherWallet = ethWallet.createWallet();
      if (!isEmptyObject(etherWallet)) {
        // const inst = new JingchangWallet(JSON.parse(JSON.stringify(jcWallet)));
        try {
          // const inst = new JingchangWallet(typeof jcWallet === "string" ? JSON.parse(jcWallet) : jcWallet);
          const inst = new JingchangWallet(jcWallet);
          const newWallet = await inst.importSecret(etherWallet.secret, password, "eth", ethWallet.getAddress);
          if (JingchangWallet.isValid(newWallet)) {
            const instance = new JingchangWallet(newWallet);
            const secret = await instance.getSecretWithType(password, 'swt');
            console.log("secret", secret);
          }
        } catch (error) {
          console.log("error", error.message);
          // throw new Error(error.message);
        }
      }
    } else {
      console.log("keystore文件不合法")
    }
  } catch (error) {
    console.log(error)
  }
}

const isEmptyObject = (obj) => {
  // if (Object.keys(obj).length === 0) {
  //   return true
  // }
  // return false
  // for (const key in obj) {
  //   return false
  // }
  // return true
  if (JSON.stringify(obj) === "{}") {
    return true
  }
  return false
}
const isEmptyString = (str) => {
  if (typeof str === "undefined" || str === null || str === "") {
    return true;
  }
  return false;
}
test()