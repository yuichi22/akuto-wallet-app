import CustomerApp from './features/customer/CustomerApp';
import AdminApp from './features/admin/AdminApp';
import PlatformApp from './features/platform/PlatformApp';

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith('/platform')) {
    return <PlatformApp />;
  }

  if (path.startsWith('/admin')) {
    return <AdminApp />;
  }

  return <CustomerApp />;
}
