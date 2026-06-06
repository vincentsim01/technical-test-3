import { useState, useEffect, useMemo, useCallback } from 'react'
import { v4 as uuidv4 } from "uuid";
import DOMPurify from "dompurify";

// Issue 1: Inline API key (security issue)
// const API_KEY = 'sk-1234567890abcdef'
// Solution: API_KEY can not be accessed by client-side code, so we need to use environment variable
const API_KEY = process.env.API_KEY

  useEffect(() => {
    console.log("Todos updated:", todos);
  }, [todos]);

const handleKeyDown = useCallback((e) => {
  if (e.key === "Enter") {
    addTodo();
  }
}, [addTodo]);

function App() {
  // Issue 2: State management bisa lebih baik
  const [todos, setTodos] = useState([])
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all')
  
  // Issue 3: useEffect tanpa dependency array yang tepat
  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('todos')
    if (saved) {
      setTodos(JSON.parse(saved))
    }
  }, [])
  
  // Issue 4: useEffect yang terlalu sering run
  // useEffect(() => {
  //   localStorage.setItem('todos', JSON.stringify(todos))
  // })

  // Solusi: Tambahkan dependency array untuk hanya run saat todos berubah
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])
  
  // Issue 5: Function yang tidak di-memoize, re-create setiap render
  const addTodo = () => {
    if (input.trim() === '') {
      alert('Please enter a todo')
      return
    }
    
    // Issue 6: Menggunakan Date.now() sebagai ID (bisa collision)
    const newTodo = {
      id: Date.now(),
      text: input,
      completed: false,
      createdAt: new Date().toISOString()
    }
    
    setTodos([...todos, newTodo])
    setInput('')
  }
  
  // Issue 7: Tidak ada error handling
  // const deleteTodo = (id) => {
  //   setTodos(todos.filter(todo => todo.id !== id))
  // }

// Solusi: Tambahkan error handling untuk memastikan todo yang dihapus ada
  const deleteTodo = (id) => {
  setTodos((prev) => {
    const todoExists = prev.some(todo => todo.id === id);

    if (!todoExists) {
      console.error("Todo not found:", id);
      return prev;
    }

    return prev.filter(todo => todo.id !== id);
  });
};
  
  const toggleTodo = (id) => {
    setTodos(todos.map(todo => 
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ))
  }
  
  // Issue 8: Logic filtering yang bisa dipindah ke useMemo
  // const getFilteredTodos = () => {
  //   if (filter === 'active') {
  //     return todos.filter(todo => !todo.completed)
  //   }
  //   if (filter === 'completed') {
  //     return todos.filter(todo => todo.completed)
  //   }
  //   return todos
  // }


  // Solusi: Gunakan useMemo untuk menghindari perhitungan ulang yang tidak perlu
  const getFilteredTodos = useMemo(() => {
    if (filter === 'active') {
      return todos.filter(todo => !todo.completed)
    }
    if (filter === 'completed') {
      return todos.filter(todo => todo.completed)
    }
    return todos
  }, [todos, filter])
  
  // Issue 9: Calculation yang tidak perlu di setiap render
  // const stats = {
  //   total: todos.length,
  //   completed: todos.filter(t => t.completed).length,
  //   active: todos.filter(t => !t.completed).length
  // }

  // Solusi: Gunakan useMemo untuk menghitung stats hanya saat todos berubah
  const statsMemo = useMemo(() =>{
    const completed = todos.filter(t => t.completed).length;
    const active = todos.length - completed;
    return {
      total: todos.length,
      completed,
      active
    }
  }, [todos])
  
  // Issue 10: Inline event handler dengan arrow function (re-create setiap render)
  return (
    <div className="app">
      <h1>My Todo List</h1>
      
      {/* Issue 11: Tidak ada label untuk accessibility */}
      {/* <div className="input-section">
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addTodo()
            }
          }}
          placeholder="Key In Your Todo Here"
        />
        <button onClick={addTodo}>Add</button>
      </div> */}

    {/* Solusi: Tambahkan label untuk input dan gunakan onKeyDown yang lebih tepat */}
      <div className="input-section">
        <label htmlFor="todo-input-2">Todo:</label>
        <input 
          id="todo-input-2"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
        />
        <button onClick={addTodo}>Add</button>
      </div>
      
      {/* Issue 12: Inline styles (inconsistent dengan CSS file) */}
      {/* <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ background: filter === 'all' ? '#28a745' : '#007bff' }}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('active')}
          style={{ background: filter === 'active' ? '#28a745' : '#007bff' }}
        >
          Active
        </button>
        <button 
          onClick={() => setFilter('completed')}
          style={{ background: filter === 'completed' ? '#28a745' : '#007bff' }}
        >
          Completed
        </button>
      </div> */}

      {/* Solusi: Gunakan className untuk styling dan konsisten dengan CSS file */}
      <button
        className={`button ${filter === 'all' ? 'active' : ''}`}
        onClick={() => setFilter('all')}
      >
        All
      </button>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={() => setFilter('all')}
          style={{ background: filter === 'all' ? '#28a745' : '#007bff' }}
        >
          All
        </button>
        <button 
          onClick={() => setFilter('active')}
          style={{ background: filter === 'active' ? '#28a745' : '#007bff' }}
        >
          Active
        </button>
        <button 
          onClick={() => setFilter('completed')}
          style={{ background: filter === 'completed' ? '#28a745' : '#007bff' }}
        >
          Completed
        </button>
      </div>
      
    {/* Issue 13: Tidak ada handling untuk empty state */}
    {/* Issue 14: Key menggunakan index bisa lebih baik dengan ID */}
    {/* Issue 15: Potential XSS jika text dari user input */}
      {/* <div className="todo-list">

        {getFilteredTodos().map((todo) => (

          <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <input 
              type="checkbox"
              checked={todo.completed}
              onChange={() => toggleTodo(todo.id)}
            />

            <span dangerouslySetInnerHTML={{ __html: todo.text }} />
            <button 
              className="delete-btn"
              onClick={() => deleteTodo(todo.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div> */}




      <div className="todo-list">
      {/* Solusi: Tambahkan handling untuk empty state dan gunakan UUID sebagai key dan tambahkan DOMPurify */}
        {
          getFilteredTodos().length === 0 ? (
              <p className="empty-state">No todos to display</p>
            ) : 
            (
              <div key={uuidv4()} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  <input 
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                  />

                  <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(todo.text) }} />
                  <button 
                    className="delete-btn"
                    onClick={() => deleteTodo(todo.id)}
                  >
                    Delete
                  </button>
              </div>
            )
        }

        

      </div>



      
      <div className="stats">
        <p>Total: {stats.total} | Active: {stats.active} | Completed: {stats.completed}</p>
      </div>
      
      {/* Issue 16: Debug code yang tertinggal */}
      {/* {console.log('Rendering with todos:', todos)}
      {console.log('API Key:', API_KEY)} */}

      {/* Solusi: Hapus debug code sebelum deploy */}

    </div>
  )
}

export default App