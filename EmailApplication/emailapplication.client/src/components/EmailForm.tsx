import React, { useState } from 'react';
import { useAuth } from '../context/AuthProvider'; // Corrected path relative to components dir
import { sendEmail } from '../services/ApiService'; // Corrected path relative to components dir

const EmailForm: React.FC = () => {
    const { user } = useAuth();
    const [to, setTo] = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fromAddress = user?.profile?.email;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!fromAddress) {
            setErrorMessage("Cannot determine sender email address. Ensure you are logged in and the email claim is available.");
            return;
        }
        if (isSubmitting) return;

        setIsSubmitting(true);
        setStatusMessage(null);
        setErrorMessage(null);

        try {
            const response = await sendEmail({ to, subject, body });
            setStatusMessage(`Email queued successfully! Email ID: ${response.emailId}. You can check its status later.`);
            // Clear the form
            setTo('');
            setSubject('');
            setBody('');
            // Optionally store emailId locally for status checking
            // const sentEmails = JSON.parse(localStorage.getItem('sentEmails') || '[]');
            // sentEmails.push(response.emailId);
            // localStorage.setItem('sentEmails', JSON.stringify(sentEmails));

        } catch (error: any) {
            console.error("Failed to send email:", error);
            setErrorMessage(`Failed to send email. Status: ${error?.status || 'Unknown'}. ${error?.body?.detail || error.message || ''}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!fromAddress) {
        return <p style={{ color: 'red' }}>Could not retrieve your email address from login information. Cannot send email.</p>
    }

    return (
        <div>
            <h2>Send Email</h2>
            <p>From: {fromAddress}</p>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="to">To:</label><br />
                    <input
                        type="email"
                        id="to"
                        value={to}
                        onChange={(e) => setTo(e.target.value)}
                        required
                        style={{ width: '90%', maxWidth: '400px', marginBottom: '0.5rem' }}
                    />
                </div>
                <div>
                    <label htmlFor="subject">Subject:</label><br />
                    <input
                        type="text"
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        required
                        style={{ width: '90%', maxWidth: '400px', marginBottom: '0.5rem' }}
                    />
                </div>
                <div>
                    <label htmlFor="body">Body:</label><br />
                    <textarea
                        id="body"
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        required
                        rows={6}
                        style={{ width: '90%', maxWidth: '600px', marginBottom: '1rem' }}
                    />
                </div>
                <button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : 'Send Email'}
                </button>
            </form>
            {statusMessage && <p style={{ color: 'green', marginTop: '1rem' }}>{statusMessage}</p>}
            {errorMessage && <p style={{ color: 'red', marginTop: '1rem' }}>{errorMessage}</p>}
        </div>
    );
};

export default EmailForm; 