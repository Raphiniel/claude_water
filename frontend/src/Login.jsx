import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { API_BASE } from './apiConfig';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE}/api/token/`, {
        username,
        password
      });

      try {
        await login(response.data.access, response.data.refresh);
      } catch {
        setError('Could not load your profile (/api/me/). Check server version.');
        return;
      }
      navigate('/');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid username or password.');
      } else {
        setError('Connection error. Is the backend running?');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="glass-panel login-panel">
        <div className="login-brand">
          <img
            className="login-brand-mark"
            src="/logo-mark.svg"
            alt=""
            width={56}
            height={64}
            decoding="async"
          />
          <img
            className="login-brand-wordmark"
            src="/logo-wordmark.svg"
            alt="WaterWise"
            width={200}
            height={40}
            decoding="async"
          />
          <p className="login-brand-tagline">Admin portal</p>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Enter admin username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter password"
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
