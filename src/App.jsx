"use client"

// useReducer added: replaces useState for todos management.
// useState is kept only for input and filter since they are simple, independent UI state
// that don't benefit from a reducer pattern.
import { useState, useEffect, useMemo, useCallback, useReducer } from 'react'
import { v4 as uuidv4 } from "uuid";
import DOMPurify from "dompurify";

// Issue 1: Inline API key (security issue)
// const API_KEY = 'sk-1234567890abcdef'
// Solution: API_KEY can not be accessed by client-side code, so we need to use environment variable
const API_KEY = import.meta.env.VITE_API_KEY;

// ─── useReducer: todoReducer ──────────────────────────────────────────────────
// WHY useReducer over useState for todos?
//
//   useState works well for simple, isolated values (a string, a boolean).
//   But todos involves multiple related operations (ADD, DELETE, TOGGLE, LOAD)
//   that all mutate the same array in different ways. With useState:
//     - Each operation (addTodo, deleteTodo, toggleTodo) is a separate function
//       that each needs to call setTodos, making the logic scattered.
//     - Functional updates (setTodos(prev => ...)) are needed to avoid stale
//       closures, but this pattern becomes repetitive and hard to follow.
//
//   useReducer centralises all todos mutation logic in one pure function.
//   Benefits:
//     1. Single source of truth for how state can change.
//     2. Each action type is explicit and self-documenting.
//     3. The reducer is a plain function — easy to unit test in isolation.
//     4. dispatch() is stable across renders (no useCallback needed for handlers
//        that only call dispatch), unlike setTodos which needs useCallback to
//        avoid re-creating callbacks on every render.
//
// Previously this was commented out (Issue 2 suggestion). It is now implemented:
// ✅ BEFORE (useState approach — scattered mutation logic):
//   const [todos, setTodos] = useState([])
//   const addTodo    = () => setTodos(prev => [...prev, newTodo])
//   const deleteTodo = (id) => setTodos(prev => prev.filter(...))
//   const toggleTodo = (id) => setTodos(prev => prev.map(...))
//
// ✅ AFTER (useReducer approach — centralised mutation logic):
//   const [todos, dispatch] = useReducer(todoReducer, [])
//   dispatch({ type: 'ADD',    payload: newTodo })
//   dispatch({ type: 'DELETE', payload: id })
//   dispatch({ type: 'TOGGLE', payload: id })
//   dispatch({ type: 'LOAD',   payload: savedTodos })  ← new: replaces setTodos in useEffect

function todoReducer(state, action) {
  switch (action.type) {

    // ADD: appends a new todo object to the array.
    // action.payload is the full todo object (id, text, completed, createdAt)
    // created in the addTodo handler before dispatching.
    case 'ADD':
      return [...state, action.payload];

    // DELETE: removes a todo by id.
    // action.payload is the id string.
    // Error handling (checking existence) is done here in the reducer
    // instead of inside the handler, keeping the handler lean.
    case 'DELETE': {
      const exists = state.some(todo => todo.id === action.payload);
      if (!exists) {
        console.error("Todo not found:", action.payload);
        return state; // return unchanged state — no crash
      }
      return state.filter(todo => todo.id !== action.payload);
    }

    // TOGGLE: flips the completed boolean for a single todo by id.
    // action.payload is the id string.
    case 'TOGGLE':
      return state.map(todo =>
        todo.id === action.payload
          ? { ...todo, completed: !todo.completed }
          : todo
      );

    // LOAD: replaces the entire state with data loaded from localStorage.
    // This replaces the old setTodos(JSON.parse(saved)) call in the
    // localStorage useEffect, keeping all state mutations inside the reducer.
    case 'LOAD':
      return action.payload;

    default:
      return state;
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function App() {
  // Issue 2: State management bisa lebih baik
  // ✅ UPDATED: todos now managed by useReducer instead of useState.
  // dispatch replaces all direct setTodos calls throughout the component.
  // ❌ const [todos, setTodos] = useState([])
  // ✅ const [todos, dispatch] = useReducer(todoReducer, [])
  const [todos, dispatch] = useReducer(todoReducer, [])

  // input and filter remain as useState — they are simple scalar values
  // with no related operations that would benefit from a reducer.
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState('all')

  // Issue 3: useEffect tanpa dependency array yang tepat
  // ✅ UPDATED: replaced setTodos(JSON.parse(saved)) with dispatch({ type: 'LOAD' })
  // so that localStorage hydration goes through the reducer like all other mutations.
  // ❌ setTodos(JSON.parse(saved))
  // ✅ dispatch({ type: 'LOAD', payload: JSON.parse(saved) })
  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('todos')
    if (saved) {
      dispatch({ type: 'LOAD', payload: JSON.parse(saved) })
    }
  }, [])

  // Issue 4: useEffect yang terlalu sering run
  // useEffect(() => {
  //   localStorage.setItem('todos', JSON.stringify(todos))
  // })

  // Solusi: Tambahkan dependency array untuk hanya run saat todos berubah
  // No change needed here — todos is still the same array derived from
  // useReducer state, so [todos] as the dependency works identically.
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos))
  }, [todos])

  // Issue 5: Function yang tidak di-memoize, re-create setiap render
  // BUG: addTodo is declared AFTER handleKeyDown below, but handleKeyDown's useCallback
  // depends on addTodo. This means at the time handleKeyDown is defined, addTodo does not
  // yet exist in scope, causing a ReferenceError or stale closure.
  // SOLUTION: Move addTodo declaration ABOVE handleKeyDown, and wrap it in useCallback
  // so its reference is stable and handleKeyDown can safely depend on it.
  //
  // ALSO BUG: addTodo still uses Date.now() as ID (Issue 6 below) — keep uuidv4() instead.
  //
  // ❌ WRONG ORDER — addTodo must be declared before handleKeyDown:
  // const handleKeyDown = useCallback((e) => {
  //   if (e.key === "Enter") {
  //     addTodo();  // ← addTodo not yet defined here!
  //   }
  // }, [todos]);
  //
  // ✅ CORRECT: First declare addTodo with useCallback, then handleKeyDown
  //
  // ✅ UPDATED with useReducer:
  // The todo object is still built here (input validation + uuidv4 belong in
  // the handler, not the reducer), then handed off via dispatch.
  // dispatch itself is stable across renders (guaranteed by React), so it does
  // NOT need to be listed as a dependency of useCallback — only `input` matters.
  // ❌ setTodos(prev => [...prev, newTodo])
  // ✅ dispatch({ type: 'ADD', payload: newTodo })
  const addTodo = useCallback(() => {
    if (input.trim() === '') {
      alert('Please enter a todo')
      return
    }
    const newTodo = {
      // Issue 6: Menggunakan Date.now() sebagai ID (bisa collision)
      // ❌ id: Date.now(),
      // ✅ Use uuidv4() for guaranteed unique IDs
      id: uuidv4(),
      text: input,
      completed: false,
      createdAt: new Date().toISOString()
    }
    // ❌ setTodos(prev => [...prev, newTodo])  ← stale closure risk; use functional update instead
    // ✅ dispatch replaces setTodos — no stale closure risk since dispatch is always stable
    dispatch({ type: 'ADD', payload: newTodo })
    setInput('')
  }, [input])

  // ✅ handleKeyDown now correctly declared AFTER addTodo
  // BUG (original): dependency array was [todos] — but handleKeyDown only uses addTodo,
  // so [todos] is incorrect and causes unnecessary re-creation on every todo change.
  // SOLUTION: dependency should be [addTodo]
  // ❌ }, [todos]);
  // ✅ }, [addTodo]);
  const handleKeyDown = useCallback((e) => {
    if (e.key === "Enter") {
      addTodo();
    }
  }, [addTodo]);

  // Issue 7: Tidak ada error handling
  // const deleteTodo = (id) => {
  //   setTodos(todos.filter(todo => todo.id !== id))
  // }

  // Solusi: Tambahkan error handling untuk memastikan todo yang dihapus ada
  // ✅ UPDATED with useReducer:
  // Error handling (existence check) has moved into the reducer's DELETE case.
  // The handler is now a simple dispatch call — no need for useCallback with a
  // complex functional setTodos update. dispatch is stable so [] deps is correct.
  // ❌ setTodos((prev) => { const exists = ...; return prev.filter(...) })
  // ✅ dispatch({ type: 'DELETE', payload: id })
  const deleteTodo = useCallback((id) => {
    dispatch({ type: 'DELETE', payload: id });
  }, []);

  // ✅ UPDATED with useReducer:
  // ❌ setTodos(prev => prev.map(...))  ← stale closure risk
  // ✅ dispatch({ type: 'TOGGLE', payload: id })
  const toggleTodo = useCallback((id) => {
    // ❌ setTodos(todos.map(...))  ← stale closure risk
    // ✅ dispatch replaces setTodos — reducer handles the map logic
    dispatch({ type: 'TOGGLE', payload: id })
  }, [])

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
  // BUG: getFilteredTodos is a memoized VALUE (an array), not a function.
  // Calling it as getFilteredTodos() in the JSX will throw:
  // "TypeError: getFilteredTodos is not a function"
  // SOLUTION: rename to filteredTodos and use it without () in JSX
  // ❌ const getFilteredTodos = useMemo(() => { ... }, [todos, filter])
  //    then used as: getFilteredTodos().length
  // ✅ const filteredTodos = useMemo(() => { ... }, [todos, filter])
  //    then used as: filteredTodos.length
  //
  // No change needed for useReducer — todos is still a plain array,
  // just derived from useReducer state instead of useState.
  const filteredTodos = useMemo(() => {
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
  // BUG: variable is named statsMemo here but referenced as {stats.total} in the JSX below.
  // This causes "TypeError: Cannot read properties of undefined (reading 'total')"
  // SOLUTION: rename to stats to match the JSX reference
  // ❌ const statsMemo = useMemo(...)
  // ✅ const stats = useMemo(...)
  //
  // No change needed for useReducer — todos is still a plain array.
  const stats = useMemo(() => {
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

      {/* BUG: Stray text node "aaaaaa" — leftover debug text, should be removed */}
      {/* ❌ aaaaaa */}

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
        <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? '#28a745' : '#007bff' }}>All</button>
        <button onClick={() => setFilter('active')} style={{ background: filter === 'active' ? '#28a745' : '#007bff' }}>Active</button>
        <button onClick={() => setFilter('completed')} style={{ background: filter === 'completed' ? '#28a745' : '#007bff' }}>Completed</button>
      </div> */}

      {/* BUG: The old inline-style filter buttons were kept alongside the new className buttons.
          This renders duplicate "All / Active / Completed" buttons — the old ones still use
          inline styles which was the original Issue 12 that was supposed to be fixed.
          SOLUTION: Remove the old inline-style block entirely and keep only the new className version. */}

      {/* Solusi: Gunakan className untuk styling dan konsisten dengan CSS file */}
      {/* ✅ Keep only this block: */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          className={`button ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          className={`button ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active
        </button>
        <button
          className={`button ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      {/* ❌ REMOVE this duplicate old inline-style block: */}
      {/* <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? '#28a745' : '#007bff' }}>All</button>
        <button onClick={() => setFilter('active')} style={{ background: filter === 'active' ? '#28a745' : '#007bff' }}>Active</button>
        <button onClick={() => setFilter('completed')} style={{ background: filter === 'completed' ? '#28a745' : '#007bff' }}>Completed</button>
      </div> */}

      {/* Issue 13: Tidak ada handling untuk empty state */}
      {/* Issue 14: Key menggunakan index bisa lebih baik dengan ID */}
      {/* Issue 15: Potential XSS jika text dari user input */}
      {/* <div className="todo-list">
        {getFilteredTodos().map((todo) => (
          <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
            <input type="checkbox" checked={todo.completed} onChange={() => toggleTodo(todo.id)} />
            <span dangerouslySetInnerHTML={{ __html: todo.text }} />
            <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>Delete</button>
          </div>
        ))}
      </div> */}

      <div className="todo-list">
        {/* Solusi: Tambahkan handling untuk empty state dan gunakan UUID sebagai key dan tambahkan DOMPurify */}
        {
          // BUG 1: getFilteredTodos is a useMemo value (an array), NOT a function.
          // Calling getFilteredTodos() throws "TypeError: getFilteredTodos is not a function"
          // ❌ getFilteredTodos().length
          // ✅ filteredTodos.length  (renamed above)
          //
          // BUG 2: The non-empty branch renders a single <div> instead of mapping over the array.
          // Only one hardcoded item is rendered — no .map() call means all other todos are invisible.
          // ❌ ) : ( <div key={uuidv4()} ...> ... </div> )
          // ✅ ) : ( filteredTodos.map((todo) => ( <div key={todo.id} ...> ... </div> )) )
          //
          // BUG 3: key={uuidv4()} generates a brand-new UUID on every render.
          // React uses keys to track identity across renders; a changing key forces a full
          // unmount+remount of the element on every render, losing focus, state, and performance.
          // ❌ key={uuidv4()}
          // ✅ key={todo.id}  (stable, unique ID assigned at creation time)
          //
          // BUG 4: todo is not defined — there is no .map() so the variable never exists.
          // Every reference to todo.completed, todo.id, todo.text throws ReferenceError.
          // ❌ className={`todo-item ${todos.completed ? 'completed' : ''}`}
          //    (also wrong: "todos" plural instead of "todo")
          // ✅ className={`todo-item ${todo.completed ? 'completed' : ''}`}
          //    inside a .map((todo) => ...) callback
          filteredTodos.length === 0 ? (
            <p className="empty-state">No todos to display</p>
          ) : (
            filteredTodos.map((todo) => (
              <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                {/*
                  BUG: Checkbox appears to "delete" the todo when clicked.
                  
                  ROOT CAUSE: The filter state defaults to 'all', but if the user is on the
                  'active' filter, checking a todo marks it completed — which immediately
                  removes it from the 'active' view. This looks like deletion but is actually
                  correct filtering behaviour. The todo still exists; switch to 'All' to see it.

                  HOWEVER, there is also a real bug here:
                  The <button> below has no type="button" attribute.
                  In HTML, a <button> without an explicit type defaults to type="submit".
                  If anything wraps this in a <form> in the future, clicking the delete
                  button (or pressing Enter near it) would submit the form AND call deleteTodo,
                  causing confusing double-fire behaviour.

                  ❌ <button className="delete-btn" onClick={...}>
                  ✅ <button type="button" className="delete-btn" onClick={...}>

                  Always set type="button" on buttons that are not meant to submit a form.
                */}
                <input
                  type="checkbox"
                  checked={todo.completed}
                  // ✅ onChange correctly calls toggleTodo (not deleteTodo)
                  // If todos disappear on check, you are likely on the 'Active' filter —
                  // completed todos are hidden from that view by design. Switch to 'All'.
                  onChange={() => toggleTodo(todo.id)}
                />
                <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(todo.text) }} />
                {/* ✅ type="button" added — prevents accidental form submission */}
                {/* ❌ <button className="delete-btn" onClick={() => deleteTodo(todo.id)}> */}
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => deleteTodo(todo.id)}
                >
                  Delete
                </button>
              </div>
            ))
          )
        }
      </div>

      <div className="stats">
        {/* BUG: stats was named statsMemo in the original but referenced as stats here.
            Fixed above by renaming the useMemo variable to stats. */}
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
