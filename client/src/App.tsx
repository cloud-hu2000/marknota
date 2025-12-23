import { Whiteboard } from './components/Whiteboard';

// 固定使用一个房间
const FIXED_ROOM_ID = 'main-room';

function App() {
  return (
    <div className="App">
      <h1>测试应用</h1>
      <p>如果能看到这个文本，说明基本功能正常。</p>
      <Whiteboard roomId={FIXED_ROOM_ID} />
    </div>
  );
}

export default App;

