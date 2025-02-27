import React from 'react';

const TestApp: React.FC = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Test App</h1>
      <p>If you can see this, React is working correctly.</p>
      <button className="btn btn-primary">Test Button</button>
    </div>
  );
};

export default TestApp; 