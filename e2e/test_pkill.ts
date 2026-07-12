import { execSync } from 'child_process';

console.log('0. Starting test...');
try { execSync('npx --no-install supabase start --ignore-health-check 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}

console.log('1. npx supabase stop...');
try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker network ls -q --filter name=supabase | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
const killCmd = 'ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
console.log('9. fuser...');
try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
console.log('10. rm temp...');
try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
console.log('11. sleep 20...');
try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
console.log('12. Done teardown!');
