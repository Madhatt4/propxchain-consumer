import { useState, useEffect } from 'react';
import icpService from '../services/icp.service';

export default function ICPTest() {
  const [status, setStatus] = useState('Initializing...');
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    initializeICP();
  }, []);

  const initializeICP = async () => {
    try {
      setStatus('Connecting to ICP...');
      await icpService.initialize();
      setStatus('✅ Connected to ICP!');
      await loadProperties();
    } catch (err: any) {
      setStatus('❌ Connection failed');
      setError(err.message);
    }
  };

  const loadProperties = async () => {
    try {
      setLoading(true);
      const props = await icpService.getAllProperties();
      setProperties(props);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const testRegisterProperty = async () => {
    try {
      setLoading(true);
      await icpService.registerProperty({
        address: '123 Test Street, London',
        price: 500000,
        size: 1500,
        propertyType: 'Residential',
        description: 'Test property from React app',
      });
      alert('Property registered successfully!');
      await loadProperties();
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🚀 ICP Blockchain Test</h1>

      <div style={{ marginBottom: '20px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
        <strong>Status:</strong> {status}
        {error && <div style={{ color: 'red', marginTop: '10px' }}><strong>Error:</strong> {error}</div>}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2>Actions</h2>
        <button
          onClick={testRegisterProperty}
          disabled={loading}
          style={{
            padding: '10px 20px',
            marginRight: '10px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Processing...' : 'Register Test Property'}
        </button>
        <button
          onClick={loadProperties}
          disabled={loading}
          style={{
            padding: '10px 20px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          Refresh Properties
        </button>
      </div>

      <div>
        <h2>Properties on Blockchain ({properties.length})</h2>
        {properties.length === 0 ? (
          <p>No properties registered yet. Click "Register Test Property" to add one!</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#333', color: 'white' }}>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>ID</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Address</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Price</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Type</th>
                <th style={{ padding: '10px', border: '1px solid #ddd' }}>Verified</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((prop) => (
                <tr key={prop.id}>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{prop.id}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{prop.address}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>£{prop.price.toLocaleString()}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{prop.propertyType}</td>
                  <td style={{ padding: '10px', border: '1px solid #ddd' }}>{prop.attestedBy ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: '40px', padding: '20px', background: '#e8f4f8', borderRadius: '5px' }}>
        <h3>🔗 Canister IDs (Mainnet)</h3>
        <ul>
          <li><strong>Property Registry:</strong> l6oow-dyaaa-aaaaa-qcwvq-cai</li>
          <li><strong>Document Verification:</strong> xand7-wiaaa-aaaah-arlea-cai</li>
          <li><strong>Transaction Manager:</strong> llj73-cqaaa-aaaaa-qcwwa-cai</li>
          <li><strong>User Management:</strong> lmizp-piaaa-aaaaa-qcwwq-cai</li>
        </ul>
      </div>
    </div>
  );
}
