import fs from 'fs-extra';
import path from 'path';
import program from 'commander';
import symbols from 'log-symbols';
import Cesium3DTiles from 'cesium-3dtiles';
import fetch from 'node-fetch';
import Child from 'cesium-3dtiles/build/data/Child';
import rd from 'rd';

program
  .option('-i, --input [string]', 'ArcGIS 切片路径(/path_to/_alllayers/).')
  .option('-o, --output [string]', '输出切片路径(/path_to/output/)')
  .option('-f, --format [string]', '输出切片规则, 现只支持TMS')
  .parse(process.argv);

function resave(filename: string, stats: any) {
  console.log(symbols.info, filename);
}
(async () => {
  const { input, output } = program;
  if (!(input && output)) {
    console.log(symbols.error, '输入 -h 查看帮助.');
    process.exit(1);
  }

  if (!fs.pathExists(path.resolve(input))) {
    console.log(symbols.error, '输入目录不存在');
    process.exit(1);
  }

  console.log(symbols.info, { input, output });
  const files: string[] = [];
  rd.eachFileFilterSync(input, /\.png$/, filename => {
    files.push(filename);
  });
  console.log(symbols.info, `共计 ${files.length} 个文件`);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const [res, l, r, c] = `${filename}`.match(
      /\/L([\w\d]+)\/R([\w\d]+)\/C([\w\d]+)\.png$/
    );

    const outfile = path.join(
      output,
      `${parseInt(l)}/${parseInt(c, 16)}/${parseInt(r, 16)}.png`
    );
    console.log(symbols.info, outfile);
    fs.copySync(filename, outfile);
    // console.log(symbols.info, `信息`, { l, r, c });
  }
  // await fs.ensureDir(path.dirname(path.join(output, uri)));
  // await fs.writeFile(path.join(output, uri), buf);
})();
