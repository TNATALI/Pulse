import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/slack', label: 'Slack' },
  { to: '/github', label: 'GitHub' },
  { to: '/people', label: 'People' },
  { to: '/settings', label: 'Settings' },
];

export function Sidebar() {
  return (
    <nav className="w-56 min-h-screen bg-gray-900 text-gray-300 flex flex-col">
      <div className="p-4 text-xl font-bold text-white border-b border-gray-700">Pulse</div>
      <ul className="flex-1 py-2">
        {navItems.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm hover:bg-gray-800 hover:text-white transition-colors ${
                  isActive ? 'bg-gray-800 text-white border-l-2 border-blue-500' : ''
                }`
              }
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
