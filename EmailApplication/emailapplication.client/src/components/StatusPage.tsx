import React, { useState } from 'react';
import { getEmailStatus } from '../services/ApiService';

const StatusPage: React.FC = () => {
    const [emailId, setEmailId] = useState('');
    const [statusResult, setStatusResult] = useState<{ id: string; status: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Potential improvement: Load list of recently sent email IDs from local storage
    // const [recentIds, setRecentIds] = useState<string[]>(() => {
    //     return JSON.parse(localStorage.getItem('sentEmails') || '[]');
    // });

    const handleCheckStatus = async (idToCheck: string) => {
        if (!idToCheck) return;
        setIsLoading(true);
        setErrorMessage(null);
        setStatusResult(null);

        try {
            const result = await getEmailStatus(idToCheck);
            setStatusResult({ id: result.emailId, status: result.status });
        } catch (error: any) {
            console.error("Failed to get email status:", error);
            setErrorMessage(`Failed to get status for ${idToCheck}. Status: ${error?.status || 'Unknown'}. ${error?.body?.detail || error?.body?.Status || error.message || 'Not Found'}`);
            // Clear previous result on error
            setStatusResult(null); 
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleCheckStatus(emailId);
    };

    return (
        <div>
            <h2>Check Email Status</h2>
            <form onSubmit={handleSubmit}>
                <label htmlFor="emailId">Enter Email ID:</label><br />
                <input
                    type="text"
                    id="emailId"
                    value={emailId}
                    onChange={(e) => setEmailId(e.target.value)}
                    required
                    style={{ width: '90%', maxWidth: '400px', marginRight: '0.5rem', marginBottom: '0.5rem' }}
                />
                <button type="submit" disabled={isLoading || !emailId}>
                    {isLoading ? 'Checking...' : 'Check Status'}
                </button>
            </form>

            {errorMessage && <p style={{ color: 'red', marginTop: '1rem' }}>{errorMessage}</p>}

            {statusResult && (
                <div style={{ marginTop: '1rem', border: '1px solid #ccc', padding: '1rem' }}>
                    <h3>Status Result:</h3>
                    <p><strong>ID:</strong> {statusResult.id}</p>
                    <p><strong>Status:</strong> {statusResult.status}</p>
                </div>
            )}

            {/* Optional: Display recently sent IDs */}
            {/* 
            <h3>Recently Sent IDs:</h3>
            {recentIds.length > 0 ? (
                <ul>
                    {recentIds.map(id => (
                        <li key={id}>
                            {id} <button onClick={() => handleCheckStatus(id)}>Check</button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No recently sent email IDs found in local storage.</p>
            )}
            */}
        </div>
    );
};

export default StatusPage; 