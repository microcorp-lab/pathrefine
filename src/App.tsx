import { Routes, Route } from 'react-router-dom';
import { EditorView } from './components/EditorView/EditorView';
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<EditorView />} />
      </Routes>
      <Toaster position="bottom-center" richColors theme="dark" />
    </>
  );
}

export default App;

