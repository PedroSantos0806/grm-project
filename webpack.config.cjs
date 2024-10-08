const path = import('path');
const HtmlWebpackPlugin = import('html-webpack-plugin');

module.exports = {
  entry: './src/index.js',   

  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname,   
 'dist')
  },
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html'
    })
  ]
};