/**
 * 모노레포용 Metro 설정.
 *
 * 워크스페이스 패키지를 소스로 직접 가져다 쓰므로(각 패키지의 `main` 이
 * `src/index.ts`) Metro 가 리포 루트까지 감시하고 루트 node_modules 를
 * 해석할 수 있어야 한다.
 */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
module.exports = config;
