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
import { toast } from 'sonner';

interface AuthRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectPath: string;
  projectId: string;
  onClose: (saved: boolean) => void;
}

export const AuthRequiredDialog: React.FC<AuthRequiredDialogProps> = ({
  open,
  onOpenChange,
  projectPath,
  projectId,
  onClose,
}) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter your Blink API key');
      return;
    }
    
    setIsLoading(true);
    try {
      const result = await window.electronAPI.updateAgentApiKey(projectPath, apiKey, 'blink');
      console.log('[AuthRequiredDialog] API key update result:', result);
      if (result.success) {
        console.log('[AuthRequiredDialog] About to call onClose(true)');
        toast.success('API key saved!');
        onClose(true); // Trigger rebuild first
        console.log('[AuthRequiredDialog] Called onClose, now closing dialog...');
        setTimeout(() => onOpenChange(false), 100); // Close dialog after a small delay
      } else {
        toast.error(`Failed to save API key: ${result.error}`);
      }
    } catch (error) {
      toast.error(`Error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <AlertCircle className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
            </div>
            <DialogTitle className="text-xl">API Key Required</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed pt-2">
            This agent needs your Blink API key to access AI models.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Blink API Key
            </label>
            <Input
              type="password"
              placeholder="Enter your Blink API key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveApiKey();
                }
              }}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Get your API key from{' '}
              <a
                href="https://blink.so/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                blink.so/settings/keys
              </a>
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleSaveApiKey} 
            disabled={isLoading || !apiKey.trim()}
            className="w-full"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
