import { updateUserTierAction } from "./src/app/actions/admin";
async function run() {
  const res = await updateUserTierAction("5159d825-79a8-488f-9278-c124e50e167a", "premium");
  console.log(res);
}
run();
