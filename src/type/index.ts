export type Filter = "all" | "active" | "completed";

export type Todo = {
  id: number;
  text: string;
  completed: boolean;
};

export type AppState = {
  todos: Todo[];
  input: string;
  filter: Filter;
};

export type Action =
  | { type: "SET_INPUT"; payload: string }
  | { type: "ADD_TODO" }
  | { type: "TOGGLE_TODO"; payload: number }
  | { type: "DELETE_TODO"; payload: number }
  | { type: "SET_FILTER"; payload: Filter };

 export const initialState: AppState = {
  todos: [],
  input: "",
  filter: "all",
};