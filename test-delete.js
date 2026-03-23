const WEB_APP_URL = "https://script.google.com/macros/s/AKfycby7WHdT8KRVWFI2QCQzK3Us_YSm6gbf_2z4AoRMll5xkBJY5-Ro2yjLp7lJqwV8jeIX/exec";
const WEB_SECRET = "ExpenseDashboard741236";

async function test() {
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'delete', row: 99, secret: WEB_SECRET })
  });
  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text);
}
test();
