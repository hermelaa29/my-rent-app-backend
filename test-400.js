import fetch from 'node-fetch';

async function test() {
  try {
    const loginRes = await fetch('http://localhost:3000/auth/lessor/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'daniel.solomon@rentms.com', password: '123456' })
    });
    const loginData = await loginRes.json();
    console.log('Login:', loginData);
    
    if (!loginData.data?.token) {
      console.error('No token');
      return;
    }
    const token = loginData.data.token;

    // Simulate EXACT frontend payload with empty strings
    const payload = {
      name: 'Test Tenant 2',
      email: 'testtenant4002@example.com',
      phone: '0911223388',
      address: '',
      passportInfo: '',
      photoUrl: ''
    };

    console.log('Sending payload:', payload);

    const res = await fetch('http://localhost:3000/users/tenants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('Status:', res.status);
    console.log('Create Tenant Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
