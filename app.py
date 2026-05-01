from flask import Flask, render_template, jsonify, request
from logic import WumpusWorld

app = Flask(__name__)

world = None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/new_game', methods=['POST'])
def new_game():
    global world
    data = request.json
    rows = int(data.get('rows', 4))
    cols = int(data.get('cols', 4))
    num_pits = int(data.get('pits', 3))
    world = WumpusWorld(rows, cols, num_pits)
    return jsonify(world.get_state())

@app.route('/api/step', methods=['POST'])
def step():
    global world
    if world is None:
        return jsonify({'error': 'No game running'}), 400
    result = world.agent_step()
    return jsonify(result)

@app.route('/api/state', methods=['GET'])
def state():
    global world
    if world is None:
        return jsonify({'error': 'No game running'}), 400
    return jsonify(world.get_state())

if __name__ == '__main__':
    app.run(debug=True)