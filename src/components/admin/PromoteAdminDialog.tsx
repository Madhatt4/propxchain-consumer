// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { Principal } from '@propxchain/core-client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { icpService } from '@/services/icp.service';

interface PromoteAdminDialogProps {
  trigger: React.ReactNode;
  csrfToken: string;
}

type Role = 'super' | 'regular';

export function PromoteAdminDialog({
  trigger,
  csrfToken,
}: PromoteAdminDialogProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState('');
  const [role, setRole] = useState<Role>('regular');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reset = (): void => {
    setTarget('');
    setNote('');
    setRole('regular');
  };

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const principal = Principal.fromText(target.trim());
      const roleVariant: { super: null } | { regular: null } =
        role === 'super' ? { super: null } : { regular: null };
      const noteOpt: [] | [string] = note ? [note] : [];

      const result = await (await icpService.requireUserManagement()).promoteAdmin(
        principal,
        roleVariant,
        noteOpt,
        csrfToken,
      );
      if ('ok' in result) {
        toast({ title: 'Admin promoted', description: `${target} → ${role}` });
        await queryClient.invalidateQueries({ queryKey: ['listAdmins'] });
        setOpen(false);
        reset();
      } else {
        toast({
          title: 'Promotion failed',
          description: Object.keys(result.err)[0],
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Invalid principal',
        description: err instanceof Error ? err.message : 'unknown',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Promote new admin</DialogTitle>
          <DialogDescription>
            Add a principal to the admin list. Super admins can promote and
            demote other admins; regular admins can use admin features but
            cannot change roles.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target">Target principal</Label>
            <Input
              id="target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="lkbe7-..."
              required
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="regular"
                  checked={role === 'regular'}
                  onChange={() => setRole('regular')}
                />
                <span>Regular admin (can use admin features)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="role"
                  value="super"
                  checked={role === 'super'}
                  onChange={() => setRole('super')}
                />
                <span>Super admin (can promote/demote others)</span>
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Backup admin for support"
            />
          </div>
          <Button type="submit" disabled={submitting || !target.trim()}>
            {submitting ? 'Promoting…' : 'Promote'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
