import fs from 'fs-extra';
import path from 'path';
import program from 'commander';
import symbols from 'log-symbols';
import Cesium3DTiles from 'cesium-3dtiles';
import fetch from 'node-fetch';
import Child from 'cesium-3dtiles/build/data/Child';

program
  .option('-i, --ionID [string]', 'Ion ID.')
  .option('-u, --username [string]', 'username')
  .option('-p, --password [string]', 'password')
  .parse(process.argv);

async function dump(uri: string, token: string) {
  return fetch(uri, {
    method: 'get',
    headers: {
      Accept: `application/json,*/*;q=0.01,*/*;access_token=${token}`
    }
  });
}
async function login(username: string, password: string) {
  const resp = await fetch('https://api.cesium.com/signIn', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ password, username })
  });
  const result = await resp.json();
  // console.log(symbols.info, '登录结果', result)
  const { token } = result;

  return token;
}
async function defaultToken() {
  const { token } = await (await fetch(
    'https://api.cesium.com/tokens/default'
  )).json();
  return token;
}
async function refreshToken() {
  const { token } = await (await fetch(
    'https://api.cesium.com/refresh'
  )).json();
  return token;
}
async function endpoint(ionID: string, access_token: string) {
  const result = await (await fetch(
    `https://api.cesium.com/v1/assets/${ionID}/endpoint`,
    {
      headers: {
        cookie: `access_token=${access_token};`
      }
    }
  )).json();
  const { accessToken } = result;
  return accessToken;
}

(async () => {
  const { ionID, username, password } = program;

  if (!(ionID && username && password)) {
    console.log(symbols.error, '输入 -h 查看帮助.');
    process.exit(1);
  }
  const output = `${ionID}`;
  console.log(symbols.info, '登录', { ionID, username, password });
  let access_token = await login(username, password);
  // console.log(symbols.info, '获取token: ', token)
  let token = await endpoint(ionID, access_token);
  console.log(symbols.info, 'accessToken', token);
  const json = await (await dump(
    `https://assets.cesium.com/${ionID}/tileset.json?v1`,
    token
  )).json();
  if (json.root) {
    console.log(symbols.success, '索引拉取成功');
  } else {
    console.log(symbols.info, json);
    console.log(symbols.success, '索引拉取失败, 退出');
    process.exit(1);
  }
  await fs.ensureDir(path.join(output));
  await fs.writeJSON(path.join(output, 'tileset.json'), json);
  const tileset = new Cesium3DTiles(json);
  console.log(
    symbols.success,
    '实例化Tileset, Version: ',
    tileset.asset.version
  );
  console.log(symbols.info, '开始遍历');
  let i = 1;
  const uris: string[] = [];
  await tileset.traverse(async (node: Child) => {
    if (!node.content) {
      return;
    }
    // console.log(symbols.info, `${i}`, node.content);
    const { uri } = node.content;
    uris.push(uri);
    i++;
  });
  console.log(symbols.info, `共计 ${uris.length} 条资源`);
  // let n = 4;
  for (let i = 0; i < uris.length; i += 1) {
    const uri = uris[i];
    if (fs.existsSync(path.join(output, uri))) {
      console.log(
        symbols.info,
        `[${i + 1}/${uris.length}]${uri}: 文件存在,跳过.`
      );
      continue;
    }
    if (i % 20 === 0) {
      // 每20条刷新一次 token 防过期
      console.log(symbols.info, `刷新 Token.`);
      access_token = await login(username, password);
      token = await endpoint(ionID, access_token);
    }
    const content = await dump(
      `https://assets.cesium.com/${ionID}/${uri}?v=1`,
      token
    );
    const buf = await content.buffer();
    console.log(
      symbols.info,
      `[${i + 1}/${uris.length}]${uri}: ${buf.length} Byte.`
    );
    await fs.ensureDir(path.dirname(path.join(output, uri)));
    await fs.writeFile(path.join(output, uri), buf);
  }
})();
