import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from './AuthContext';

const Settings = () => {
    const [mode, setMode] = useState('NORMAL');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(false);
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const response = await axios.get('http://localhost:8000/api/settings/', {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setMode(response.data.mode);
            } catch (err) {
                console.error("Failed to fetch settings", err);
            }
        };
        fetchSettings();
    }, [user]);

    const handleModeChange = async (newMode) => {
        try {
            await axios.post('http://localhost:8000/api/settings/', { mode: newMode }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setMode(newMode);
            setMessage({ type: 'success', text: 'System mode updated successfully!' });
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update system mode.' });
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'Passwords do not match.' });
            return;
        }

        setLoading(true);
        try {
            await axios.post('http://localhost:8000/api/password-change/', {
                old_password: oldPassword,
                new_password: newPassword
            }, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setMessage({ type: 'success', text: 'Password changed successfully! Logging out...' });
            setTimeout(() => logout(), 2000);
        } catch (err) {
            const errorMsg = err.response?.data?.old_password?.[0] || 'Failed to change password.';
            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h2>System Settings</h2>
                <p style={{ color: 'var(--text-muted)' }}>Configure system modes and security</p>
            </div>

            <div className="settings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                <section className="glass-panel">
                    <h3>System Mode</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Set the operational state of the Waterwise network.
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {['NORMAL', 'EMERGENCY', 'MAINTENANCE'].map((m) => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m)}
                                className={`btn-secondary ${mode === m ? 'active-mode' : ''}`}
                                style={{ 
                                    textAlign: 'left', 
                                    padding: '1rem',
                                    border: mode === m ? '1px solid var(--primary)' : '1px solid var(--card-border)',
                                    background: mode === m ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-color)',
                                    marginBottom: '0.5rem',
                                    borderRadius: '8px',
                                    width: '100%',
                                    cursor: 'pointer'
                                }}
                            >
                                <span style={{ fontWeight: 600 }}>{m.charAt(0) + m.slice(1).toLowerCase()} Mode</span>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {m === 'NORMAL' && "Standard operation and reporting."}
                                    {m === 'EMERGENCY' && "High priority alerts and immediate response."}
                                    {m === 'MAINTENANCE' && "System in scheduled repair state."}
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="glass-panel">
                    <h3>Change Password</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                        Update your administrator credentials.
                    </p>

                    <form onSubmit={handlePasswordChange} className="login-form">
                        <div className="form-group">
                            <label>Current Password</label>
                            <input 
                                type="password" 
                                value={oldPassword} 
                                onChange={(e) => setOldPassword(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>New Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label>Confirm New Password</label>
                            <input 
                                type="password" 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                required 
                            />
                        </div>
                        
                        {message.text && (
                            <div style={{ 
                                padding: '0.75rem', 
                                borderRadius: '8px', 
                                marginTop: '1rem',
                                background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: message.type === 'success' ? 'var(--success)' : '#fca5a5',
                                border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                fontSize: '0.9rem',
                                textAlign: 'center'
                            }}>
                                {message.text}
                            </div>
                        )}

                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Updating...' : 'Save Password'}
                        </button>
                    </form>
                </section>
            </div>
        </div>
    );
};

export default Settings;
