using UnityEngine;
using UnityEngine.Events;
// Put on an object named CloudUIBridge. Wire restartCheckpoint to the game's checkpoint manager.
public class CloudUIBridge:MonoBehaviour {
 public UnityEvent restartCheckpoint;
 float previousScale=1;
 public void Pause(){previousScale=Time.timeScale;Time.timeScale=0;AudioListener.pause=true;Cursor.lockState=CursorLockMode.None;}
 public void Resume(){Time.timeScale=previousScale;AudioListener.pause=false;}
 public void RestartCheckpoint(){restartCheckpoint.Invoke();}
}
