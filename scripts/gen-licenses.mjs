// 앱에 들어가는 직접 의존성의 이름·버전·라이선스를 모아 src/constants/licenses.json으로 저장.
// 의존성을 추가/변경하면 다시 실행: node scripts/gen-licenses.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const list = Object.keys(pkg.dependencies)
  .sort()
  .map((name) => {
    const p = JSON.parse(readFileSync(`node_modules/${name}/package.json`, 'utf8'));
    const license = typeof p.license === 'string' ? p.license : (p.license?.type ?? 'UNKNOWN');
    return { name, version: p.version, license };
  });
writeFileSync('src/constants/licenses.json', JSON.stringify(list, null, 2) + '\n');
console.log(`${list.length} packages`, [...new Set(list.map((l) => l.license))].join(', '));
