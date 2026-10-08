import { Card } from '@/components/ui/card';
import { AccountForm } from '@/components/settings/account-form';
import { getCurrentUser } from '@/lib/current-user';
import { changePasswordAction, updateAccountAction } from '../actions';

export default async function AccountSettingsPage() {
  const user = await getCurrentUser();

  return (
    <Card className="p-6 sm:p-8">
      <AccountForm
        user={{ name: user.name, email: user.email }}
        updateAccountAction={updateAccountAction}
        changePasswordAction={changePasswordAction}
      />
    </Card>
  );
}
