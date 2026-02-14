import { Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/Dashboard';
import { SlackPage } from './pages/Slack';
import { GitHubPage } from './pages/GitHub';
import { PeoplePage } from './pages/People';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/slack" element={<SlackPage />} />
        <Route path="/github" element={<GitHubPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
