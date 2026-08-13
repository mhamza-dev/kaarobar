import React from 'react';
import {render} from '@testing-library/react-native';
import {it} from '@jest/globals';

import App from '../App';

it('renders correctly', () => {
  render(<App />);
});
