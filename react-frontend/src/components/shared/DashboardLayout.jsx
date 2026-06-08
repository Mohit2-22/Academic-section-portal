import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { useLocation } from 'react-router-dom';

const pageTitles = {
  student: {
    home: 'Student Dashboard', timetable: 'Timetable', notifications: 'Notifications',
    certificates: 'My Certificates', 'online-class': 'Join Online Class',
    materials: 'Study Materials', videos: 'Video Tutorials', ide: 'Practice IDE',
    feedback: 'Faculty Feedback'
  },
  faculty: {
    home: 'Faculty Dashboard', schedule: 'Schedule Lecture', class: 'Start/End Class',
    materials: 'Upload Material', videos: 'Upload Video Tutorials',
    assignments: 'Assignments', notification: 'Send Notification'
  },
  admin: {
    home: 'Admin Dashboard', 'create-student': 'Create Student',
    'create-faculty': 'Create Faculty', 'create-batch': 'Create Batch',
    'add-students': 'Add Students to Batch', certificates: 'Certificates',
    notification: 'Send Notification'
  },
  admission_staff: {
    home: 'Admission Dashboard', inquiries: 'Inquiry Tracker',
    reports: 'Reports', fees: 'Fees Status', revoke: 'Revoke Access',
    notification: 'Send Notification'
  },
  super_admin: {
    home: 'Super Admin Dashboard', 'create-admin': 'Create Admin',
    'create-admission': 'Create Admission Staff', 'create-faculty': 'Create Faculty',
    users: 'Manage Users', fees: 'Fees Dashboard', batches: 'Batches Dashboard'
  }
};

export default function DashboardLayout({ role }) {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const segment = location.pathname.split('/').pop();
  const titles = pageTitles[role] || {};
  const title = titles[segment] || 'Dashboard';

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div className={`main-area ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <TopNavbar title={title} />
        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
