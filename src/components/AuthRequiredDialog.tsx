import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { AlertCircle, Key, ExternalLink } from 'lucide-react';

interface AuthRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  onUseApiKey: (apiKey: string, provider: string) => void;
}

export const AuthRequiredDialog: React.FC<AuthRequiredDialogProps> = ({
  open,
  onOpenChange,
  projectPath,
  onUseApiKey,
}) => {
  const [view, setView] = useState<'choose' | 'api-key'>('choose');
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<'anthropic' | 'openai'>('anthropic');
  const [isLoading, setIsLoading] = useState(false);

  const handleBlinkLogin = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.runBlinkLogin();
      if (result.success) {
        alert('Successfully logged in to Blink! Please restart your project.');
        onOpenChange(false);
      } else {
        alert(`Login failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseApiKey = () => {
    if (!apiKey.trim()) {
      alert('Please enter an API key');
      return;
    }
    onUseApiKey(apiKey, provider);
    onOpenChange(false);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Logging in to Blink...</DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-2">
              A browser window should open shortly.
              <br />
              <br />
              Complete the authentication in your browser, then this dialog will close automatically.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {view === 'choose' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
                </div>
                <DialogTitle className="text-xl">Authentication Required</DialogTitle>
              </div>
              <DialogDescription className="text-base leading-relaxed pt-2">
                This agent needs AI model access. Choose how you'd like to authenticate:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <button
                onClick={handleBlinkLogin}
                disabled={isLoading}
                className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <ExternalLink className="w-5 h-5 mt-0.5 text-primary" />
                  <div>
                    <h3 className="font-medium mb-1">Login to Blink</h3>
                    <p className="text-sm text-muted-foreground">
                      Use Blink's model gateway (includes multiple AI providers)
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setView('api-key')}
                className="w-full p-4 border rounded-lg hover:bg-accent transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <Key className="w-5 h-5 mt-0.5 text-primary" />
                  <div>
                    <h3 className="font-medium mb-1">Use Your Own API Key</h3>
                    <p className="text-sm text-muted-foreground">
                      Configure Anthropic or OpenAI directly
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Key className="w-6 h-6 text-primary" />
                </div>
                <DialogTitle className="text-xl">Configure API Key</DialogTitle>
              </div>
              <DialogDescription className="text-base leading-relaxed pt-2">
                Enter your API key to use AI models directly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Provider</label>
                <div className="flex gap-2">
                  <Button
                    variant={provider === 'anthropic' ? 'default' : 'outline'}
                    onClick={() => setProvider('anthropic')}
                    className="flex-1"
                  >
                    Anthropic (Claude)
                  </Button>
                  <Button
                    variant={provider === 'openai' ? 'default' : 'outline'}
                    onClick={() => setProvider('openai')}
                    className="flex-1"
                  >
                    OpenAI (GPT)
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  {provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} API Key
                </label>
                <Input
                  type="password"
                  placeholder={`sk-ant-... or sk-proj-...`}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Get your API key from{' '}
                  <a
                    href={provider === 'anthropic' ? 'https://console.anthropic.com' : 'https://platform.openai.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {provider === 'anthropic' ? 'console.anthropic.com' : 'platform.openai.com'}
                  </a>
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setView('choose')}>
                Back
              </Button>
              <Button onClick={handleUseApiKey}>
                Save API Key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
