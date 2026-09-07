import { runOneJob } from './lib/reportWorker';

let stopping = false;
process.on('SIGTERM',() => { stopping = true; });
process.on('SIGINT',() => { stopping = true; });
async function main() {
  while (!stopping) {
    if (!await runOneJob()) await new Promise(resolve => setTimeout(resolve,1000));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
