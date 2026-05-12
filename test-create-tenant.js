import fetch from 'node-fetch'; // We will just use node fetch if available, or native fetch
async function test() {
  try {
    // We need a token first.
    // Let's get Daniel Solomon's token
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

    const res = await fetch('http://localhost:3000/users/tenants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'Test Tenant',
        email: 'test@example.com',
        phone: '1234567890',
        address: '123 Test St',
        passportInfo: 'AB123456',
      })
    });
    const data = await res.json();
    console.log('Create Tenant Response:', data);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
