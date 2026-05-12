import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/auth/lessor/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'daniel.solomon@rentms.com', password: '123456' })
  });
  const data = await res.json();
  console.log('Login Response:', JSON.stringify(data, null, 2));

  if (!data.data?.token) return;
  const token = data.data.token;
  
  // manually decode jwt payload
  const payloadB64 = token.split('.')[1];
  const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
  console.log('JWT Payload:', JSON.stringify(payload, null, 2));

  // now send request to create tenant
  const tenantRes = await fetch('http://localhost:3000/users/tenants', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      name: 'Test',
      email: `test${Date.now()}@example.com`,
      phone: `09${Math.floor(Math.random() * 100000000)}`,
      address: '',
      passportInfo: '',
      photoUrl: ''
    })
  });
  const tenantData = await tenantRes.json();
  console.log('Tenant Create Response:', tenantRes.status, JSON.stringify(tenantData, null, 2));
}

test();
