import { Alert, Platform } from 'react-native';

// Einheitliche Hinweise und Rueckfragen (funktionieren auch in der Web-Vorschau)
export function notify(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

export function confirmDialog(title: string, message: string, okText: string, onOk: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onOk();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Abbrechen', style: 'cancel' },
    { text: okText, style: destructive ? 'destructive' : 'default', onPress: onOk },
  ]);
}
